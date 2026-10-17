"""Native Linejam tick. Copy Overmind's isolated build / trusted Wrangler boundary."""
import argparse
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from train_state import Effect, Event, Journal, Phase, TERMINAL

ACCOUNT = 'b069014f6a46558ea9146fb6c4ff8f6c'
PROVIDER = 'https://api.cloudflare.com/client/v4'
ORIGIN = 'https://linejam.mistystep.io'


def command(*args, **kwargs):
    return subprocess.check_output(list(map(str, args)), stderr=subprocess.STDOUT, text=True, **kwargs).strip()


def committed_config(repo, sha):
    text = command('git', 'show', sha + ':wrangler.jsonc', cwd=repo)
    text = re.sub(r'(?m)^\s*//.*$', '', text)
    return json.loads(re.sub(r',(\s*[}\]])', r'\1', text))


def expected_config(repo, sha):
    source = committed_config(repo, sha)
    production = source['env']['production']
    if source['account_id'] != ACCOUNT or production['name'] != 'linejam':
        raise ValueError('Native target contract changed; operator decision required')
    return {
        'name': production['name'], 'account_id': source['account_id'],
        'main': 'modules/worker.js', 'no_bundle': True, 'find_additional_modules': True,
        'rules': [{'type': 'CompiledWasm', 'globs': ['**/*.wasm'], 'fallthrough': True},
                  {'type': 'Data', 'globs': ['**/*.bin'], 'fallthrough': True}],
        'compatibility_date': source['compatibility_date'],
        'compatibility_flags': source['compatibility_flags'],
        'workers_dev': False, 'preview_urls': False, 'send_metrics': False,
        'observability': source['observability'], 'routes': production['routes'],
        'assets': {**source['assets'], 'directory': 'assets'},
        'durable_objects': production['durable_objects'], 'migrations': source['migrations'],
        'vars': {**production['vars'], 'NEXT_DEPLOYMENT_ID': sha},
    }


def tree_hashes(root):
    if not stat.S_ISDIR(root.lstat().st_mode):
        raise ValueError('Artifact must be an ordinary directory')
    hashes = {}
    for path in sorted(root.rglob('*')):
        mode = path.lstat().st_mode
        if not (stat.S_ISDIR(mode) or stat.S_ISREG(mode)):
            raise ValueError('No artifact symlinks or special files')
        relative = path.relative_to(root)
        if any(part.startswith('.') or part in ('node_modules', 'package.json') for part in relative.parts):
            raise ValueError('No executable deployment tooling/config discovery in artifact')
        if path.is_file():
            hashes[str(relative)] = hashlib.sha256(path.read_bytes()).hexdigest()
    return hashes


def stage_artifact(source, destination, expected):
    tree_hashes(source)
    if json.loads((source / 'wrangler.json').read_text()) != expected:
        raise ValueError('Packaged config differs from trusted committed contract')
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(source, destination, copy_function=shutil.copyfile)
    return tree_hashes(destination)


@contextmanager
def exclusive(path, wait=False):
    with path.open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | (0 if wait else fcntl.LOCK_NB))
        except BlockingIOError:
            yield False
            return
        yield True


@contextmanager
def candidate_source(repo, sha, home):
    with tempfile.TemporaryDirectory(prefix='candidate-', dir=home) as directory:
        source = Path(directory)
        command('git', 'clone', '--no-hardlinks', '--no-checkout', repo, source)
        command('git', 'checkout', '--detach', sha, cwd=source)
        yield source


def build(args, source, log):
    name = f'linejam-train-{os.getpid()}'
    docker = ['docker', 'run', '--rm', '--init', '--name', name,
              '--cgroup-parent=gha-runners.slice', '--cpus=4', '--memory=8g', '--pids-limit=2048',
              '--cap-drop=ALL', '--security-opt=no-new-privileges', '--read-only',
              '--user', f'{os.getuid()}:{os.getgid()}', '--tmpfs', '/tmp:rw,size=1g',
              '--entrypoint', '/bin/bash']
    for key in ('network', 'dns'):
        if getattr(args, key):
            docker += ['--' + key, getattr(args, key)]
    for host, container, mode in ((source, '/workspace', 'rw'), (args.home / 'cache', '/cache', 'rw'),
                                  (args.node, '/node', 'ro'), (args.pnpm, '/pnpm', 'ro'),
                                  (args.rustup, '/rustup', 'ro'), (args.cargo_bin, '/rust-bin', 'ro'),
                                  (args.public_config, '/production-public.json', 'ro')):
        docker += ['--volume', f'{host}:{container}:{mode}']
    for key, value in {'HOME': '/cache/home', 'TMPDIR': '/cache/tmp', 'CARGO_HOME': '/cache/cargo',
                       'CARGO_TARGET_DIR': '/cache/target', 'RUSTUP_HOME': '/rustup',
                       'PLAYWRIGHT_BROWSERS_PATH': '/cache/ms-playwright',
                       'PATH': '/node/bin:/pnpm:/rust-bin:/usr/local/bin:/usr/bin:/bin',
                       'GIT_CONFIG_COUNT': '1', 'GIT_CONFIG_KEY_0': 'safe.directory',
                       'GIT_CONFIG_VALUE_0': '/workspace'}.items():
        docker += ['--env', key + '=' + value]
    script = ('pnpm install --frozen-lockfile --store-dir /cache/pnpm && '
              'pnpm --dir dagger install --frozen-lockfile --store-dir /cache/pnpm && '
              'pnpm exec playwright install chromium && '
              f'pnpm release:check --mode {args.mode} --public-config /production-public.json')
    docker += ['--workdir', '/workspace', args.image, '-c', script]
    try:
        subprocess.run(docker, stdout=log, stderr=log, check=True)
    finally:
        subprocess.run(['docker', 'rm', '-f', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def get(url, token=None):
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; LinejamNativeRelease/1)'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    try:
        response = urllib.request.build_opener(NoRedirect()).open(
            urllib.request.Request(url, headers=headers), timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, response.read()


def deployed(token):
    status, body = get(f'{PROVIDER}/accounts/{ACCOUNT}/workers/scripts/linejam/deployments', token)
    if status != 200:
        raise RuntimeError('Provider deployment readback failed')
    data = json.loads(body)
    versions = data['result']['deployments'][0]['versions'] if data['success'] else []
    if len(versions) != 1 or versions[0]['percentage'] != 100:
        raise RuntimeError('Expected one fully serving Worker version')
    return versions[0]['version_id']


def serving_source():
    status, body = get(ORIGIN + '/api/health')
    source = json.loads(body).get('deployment', {}).get('id')
    if status not in (200, 503) or not re.fullmatch('[0-9a-f]{40}', source or ''):
        raise RuntimeError('Unknown serving source; preserve recovery evidence')
    return source


def smoke(sha, artifact=None):
    deadline = time.monotonic() + 30
    while True:
        try:
            status, body = get(ORIGIN + '/api/health')
            report = json.loads(body)
            if status != 200 or report.get('status') != 'ok' or report.get('deployment', {}).get('id') != sha:
                raise RuntimeError('Serving release/health mismatch')
            if report.get('convex') != 'connected' or not report.get('env', {}).get('guestTokenParity'):
                raise RuntimeError('Backend readiness mismatch')
            status, body = get(ORIGIN + '/')
            if status != 200 or b'Linejam' not in body or b'</html>' not in body:
                raise RuntimeError('Player entry shell unavailable')
            if artifact:
                if b'linejam-entry' not in body:
                    raise RuntimeError('Rust entry is absent from serving shell')
                path = artifact / 'assets/entry-wasm/entry_bg.wasm'
                status, body = get(ORIGIN + '/entry-wasm/entry_bg.wasm')
                if status != 200 or hashlib.sha256(body).digest() != hashlib.sha256(path.read_bytes()).digest():
                    raise RuntimeError('Serving Rust artifact differs from tested module')
            return
        except Exception:
            if time.monotonic() >= deadline:
                raise
            time.sleep(1)


def deployment_tool(args, sha):
    if args.wrangler.is_relative_to(args.home):
        raise ValueError('Deployment tool cannot be in writable build state')
    lock = command('git', 'show', sha + ':pnpm-lock.yaml', cwd=args.repo)
    version = re.search(r'(?m)^    wrangler:\n      specifier: [^\n]+\n      version: ([0-9.]+)', lock)
    installed = json.loads((args.wrangler.parent.parent / 'package.json').read_text())['version']
    if not version or version[1] != installed:
        raise ValueError('Trusted Wrangler must match the committed lockfile')
    return [str(args.node / 'bin/node'), str(args.wrangler)]


def promote(args, journal, token, log):
    artifact = args.home / 'artifact'
    state = journal.state
    if state.phase == Phase.FORWARD:
        if tree_hashes(artifact) != dict(state.hashes):
            raise ValueError('Artifact changed after isolated proof')
        prior = serving_source()
        command('git', 'merge-base', '--is-ancestor', prior, state.candidate, cwd=args.repo)
        if committed_config(args.repo, prior)['migrations'] != committed_config(args.repo, state.candidate)['migrations']:
            raise ValueError('Migration changed; compatible rollback needs an explicit decision')
        # Persist the exact pointer AND source before the first provider mutation.
        effects = journal.record(Event.FORWARD, [(prior, deployed(token))])
    else:
        effects = journal.record(Event.FAILED) if state.phase in (Phase.DEPLOY, Phase.SMOKE) else (
            ((Effect.ROLLBACK, state.remaining[0]),) if state.phase == Phase.ROLLBACK else ((Effect.RECOVER, None),))
    tool = deployment_tool(args, journal.state.candidate)
    environment = {key: os.environ[key] for key in ('PATH', 'HOME', 'SSL_CERT_FILE') if key in os.environ}
    environment.update(CLOUDFLARE_API_TOKEN=token, CI='1', WRANGLER_SEND_METRICS='false')
    config = str(artifact / 'wrangler.json')
    while effects:
        effect, prior = effects[0]
        state = journal.state
        if effect == Effect.REPORT:
            raise RuntimeError('Release failed; recovery=' + state.phase)
        try:
            if effect == Effect.DEPLOY:
                subprocess.run([*tool, 'deploy', '--config', config, '--message', 'git:' + state.candidate],
                               cwd=artifact, env=environment, stdout=log, stderr=log, check=True)
                current = deployed(token)
                if current == state.targets[0][1]:
                    raise RuntimeError('Provider version did not change')
                status, body = get(f'{PROVIDER}/accounts/{ACCOUNT}/workers/scripts/linejam/versions/{current}', token)
                if status != 200 or json.loads(body)['result']['annotations'].get('workers/message') != 'git:' + state.candidate:
                    raise RuntimeError('Provider source annotation mismatch')
                event, value = Event.DEPLOYED, prior
            elif effect == Effect.SMOKE:
                smoke(state.candidate, artifact)
                if tree_hashes(artifact) != dict(state.hashes):
                    raise RuntimeError('Promotion changed tested input')
                event, value = Event.SMOKED, None
            elif effect == Effect.ROLLBACK:
                version = dict(state.targets)[prior]
                subprocess.run([*tool, 'rollback', version, '--config', config, '--yes'],
                               cwd=artifact, env=environment, stdout=log, stderr=log, check=True)
                if deployed(token) != version:
                    raise RuntimeError('Recovery pointer mismatch')
                event, value = Event.ROLLED_BACK, prior
            else:
                smoke(state.targets[0][0])
                event, value = Event.RECOVERED, None
        except Exception as error:
            print('Native effect failed: ' + type(error).__name__, file=log, flush=True)
            event = Event.ROLLBACK_FAILED if effect == Effect.ROLLBACK else Event.RECOVERY_FAILED if effect == Effect.RECOVER else Event.FAILED
            value = prior if effect == Effect.ROLLBACK else None
        effects = journal.record(event, value)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('repo', 'home', 'node', 'pnpm', 'rustup', 'cargo-bin', 'public-config'):
        parser.add_argument('--' + name, type=lambda value: Path(value).resolve(), required=True)
    parser.add_argument('--wrangler', type=lambda value: Path(value).resolve())
    parser.add_argument('--image', required=True)
    parser.add_argument('--network')
    parser.add_argument('--dns')
    parser.add_argument('--mode', choices=('fast', 'full'), default='fast')
    parser.add_argument('--candidate')
    parser.add_argument('--promote', action='store_true')
    args = parser.parse_args()
    if args.candidate and (args.promote or not re.fullmatch('[0-9a-f]{40}', args.candidate)):
        parser.error('Exact diagnostic candidates cannot promote')
    if args.promote and (args.mode != 'fast' or not args.wrangler):
        parser.error('Promotion needs native fast mode and a trusted Wrangler')
    if not re.fullmatch('sha256:[0-9a-f]{64}', args.image):
        parser.error('Use an immutable build image')
    for path in (args.repo, args.node, args.pnpm, args.rustup, args.cargo_bin, args.public_config):
        if path.is_relative_to(args.home):
            parser.error('Trusted inputs must be outside writable build state')
    args.home.mkdir(parents=True, exist_ok=True)
    with exclusive(args.home / 'tick.lock', wait=args.mode == 'full') as acquired:
        if not acquired:
            return 0
        journal = Journal(args.home / 'events.jsonl')
        sha = journal.state.candidate
        logs = args.home / 'logs'
        logs.mkdir(exist_ok=True)
        for old in logs.glob('*.log'):
            if old.stat().st_mtime < time.time() - 7 * 86400:
                old.unlink()
        log_path = logs / (str(time.time_ns()) + '.log')
        with log_path.open('a') as log:
            try:

                if journal.state.phase == Phase.ESCALATED:
                    raise RuntimeError('Recovery failed; operator decision required before another promotion')
                if journal.state.phase not in TERMINAL:
                    if journal.state.phase in (Phase.BUILD, Phase.FORWARD):
                        journal.record(Event.FAILED)
                        raise RuntimeError('Interrupted build; no provider mutation attempted')
                    if not args.promote:
                        raise RuntimeError('Production recovery must finish before diagnostics')
                    if json.loads((args.home / 'artifact/wrangler.json').read_text()) != expected_config(args.repo, sha):
                        raise ValueError('Interrupted artifact config differs from trusted source')
                    token = command('pass', 'show', 'workstation/MISTY_STEP_CD_CLOUDFLARE_TOKEN').splitlines()[0]
                    promote(args, journal, token, log)
                command('git', 'fetch', 'origin', 'master', cwd=args.repo)
                sha = args.candidate or command('git', 'rev-parse', 'FETCH_HEAD', cwd=args.repo)
                mode = 'promote' if args.promote else 'diagnostic' if args.candidate or args.mode == 'full' else 'verify'
                journal.record(Event.SELECT, (sha, mode))
                if journal.state.phase == Phase.SKIPPED:
                    return 0
                expected = expected_config(args.repo, sha)
                if args.promote:
                    # Deployment ownership is retired in the source being promoted.
                    old = subprocess.run(['git', 'cat-file', '-e', sha + ':.github/workflows/cloudflare-production.yml'], cwd=args.repo,
                                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    if old.returncode == 0:
                        raise RuntimeError('Retire the old deployment authority before native promotion')
                    deployment_tool(args, sha)
                for name in ('home', 'tmp', 'cargo', 'target', 'ms-playwright'):
                    (args.home / 'cache' / name).mkdir(parents=True, exist_ok=True)
                with candidate_source(args.repo, sha, args.home) as source:
                    try:
                        build(args, source, log)
                        hashes = stage_artifact(source / '.release', args.home / 'artifact', expected)
                    finally:
                        if (source / '.qa/release').exists():
                            tree_hashes(source / '.qa/release')
                            destination = args.home / 'evidence'
                            if destination.exists():
                                shutil.rmtree(destination)
                            shutil.copytree(source / '.qa/release', destination)
                journal.record(Event.BUILT, hashes)
                if args.promote:
                    # Build process and checkout are gone before credentials are read.
                    token = command('pass', 'show', 'workstation/MISTY_STEP_CD_CLOUDFLARE_TOKEN').splitlines()[0]
                    promote(args, journal, token, log)
                print(json.dumps({'candidate': sha, 'mode': args.mode, 'promoted': args.promote, 'state': journal.state.phase, 'log': str(log_path)}), file=log, flush=True)
                return 0
            except Exception as error:
                if journal.state.phase in (Phase.BUILD, Phase.FORWARD):
                    journal.record(Event.FAILED)
                print(f'Failure: {type(error).__name__}; {error}', file=log, flush=True)
                print(f'Linejam native release failed; candidate={sha}; state={journal.state.phase}; evidence=mirrodin-hq:{log_path}; owner=Kaylee', file=sys.stderr)
                return 1


if __name__ == '__main__':
    sys.exit(main())
