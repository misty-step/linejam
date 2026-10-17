"""Native state/artifact contracts. Real artifact proof lives in release:verify."""
import json
from pathlib import Path
import random
import tempfile
import unittest

from train_state import Effect, Event, Journal, Phase, State, TERMINAL, project, step
from train import expected_config, regular_tree, stage_artifact, tree_hashes

SHA = 'a' * 40
OLD = 'b' * 40


class TrainStateTests(unittest.TestCase):
    def start(self):
        state, effects = step(State(), Event.SELECT, (SHA, 'promote'))
        self.assertEqual(effects, ((Effect.BUILD, None),))
        return state

    def ready(self):
        state, effects = step(self.start(), Event.BUILT, {'worker.js': 'digest'})
        self.assertEqual(effects, ((Effect.FORWARD, None),))
        return state

    def deploying(self):
        state, effects = step(self.ready(), Event.FORWARD, [(OLD, 'previous-version')])
        self.assertEqual(effects, ((Effect.DEPLOY, OLD),))
        return state

    def test_success_is_source_bound_and_equal_trunk_coalesces(self):
        state, effects = step(self.deploying(), Event.DEPLOYED, OLD)
        self.assertEqual(effects, ((Effect.SMOKE, None),))
        state, effects = step(state, Event.SMOKED)
        self.assertEqual(state.phase, Phase.SUCCESS)
        self.assertEqual(effects, ())
        state, effects = step(state, Event.SELECT, (SHA, 'promote'))
        self.assertEqual(state.phase, Phase.SKIPPED)
        self.assertEqual(effects, ())

    def test_build_and_forward_failures_never_request_provider_writes(self):
        for state in (self.start(), self.ready()):
            failed, effects = step(state, Event.FAILED)
            self.assertEqual(failed.phase, Phase.FAILED)
            self.assertEqual(effects, ((Effect.REPORT, None),))

    def test_failure_or_interruption_restores_exact_snapshot_then_checks_recovery(self):
        for state in (self.deploying(), step(self.deploying(), Event.DEPLOYED, OLD)[0]):
            state, effects = step(state, Event.FAILED)
            self.assertEqual(effects, ((Effect.ROLLBACK, OLD),))
            self.assertEqual(dict(state.targets)[OLD], 'previous-version')
            state, effects = step(state, Event.ROLLED_BACK, OLD)
            self.assertEqual(effects, ((Effect.RECOVER, None),))
            state, effects = step(state, Event.RECOVERED)
            self.assertEqual(state.phase, Phase.FAILED)
            self.assertEqual(effects, ((Effect.REPORT, None),))

    def test_failed_rollback_and_failed_recovery_escalate_without_success(self):
        state, _ = step(self.deploying(), Event.FAILED)
        escalated, effects = step(state, Event.ROLLBACK_FAILED, OLD)
        self.assertEqual(escalated.phase, Phase.ESCALATED)
        self.assertEqual(escalated.rollback_failures, (OLD,))
        self.assertEqual(effects, ((Effect.REPORT, None),))
        state, _ = step(state, Event.ROLLED_BACK, OLD)
        state, _ = step(state, Event.RECOVERY_FAILED)
        self.assertEqual(state.phase, Phase.ESCALATED)

    def test_periodic_full_and_explicit_diagnostics_do_not_coalesce_or_admit_release(self):
        state = State()
        for _ in range(2):
            state, effects = step(state, Event.SELECT, (SHA, 'diagnostic'))
            self.assertEqual(effects, ((Effect.BUILD, None),))
            state, effects = step(state, Event.BUILT, {})
            self.assertEqual(state.phase, Phase.SUCCESS)
            self.assertEqual(effects, ())
            self.assertEqual(state.last, ())

    def test_selection_cannot_displace_an_in_flight_attempt(self):
        for state in (self.start(), self.ready(), self.deploying()):
            with self.assertRaises(ValueError):
                step(state, Event.SELECT, (OLD, 'promote'))
        for bad in ('main', '', 'a' * 39, 'A' * 40):
            with self.assertRaises(ValueError):
                step(State(), Event.SELECT, (bad, 'promote'))

    def test_random_event_sequences_keep_snapshots_and_replay_invariants(self):
        rng = random.Random(79984)
        for _ in range(512):
            state = State()
            history = []
            for _ in range(64):
                if state.phase in TERMINAL:
                    event, value = Event.SELECT, (rng.choice((SHA, OLD)), rng.choice(('promote', 'verify', 'diagnostic')))
                elif state.phase == Phase.BUILD:
                    event, value = rng.choice(((Event.BUILT, {'worker': 'digest'}), (Event.FAILED, None)))
                elif state.phase == Phase.FORWARD:
                    event, value = rng.choice(((Event.FORWARD, [(OLD, 'previous')]), (Event.FAILED, None)))
                elif state.phase == Phase.DEPLOY:
                    event, value = rng.choice(((Event.DEPLOYED, OLD), (Event.FAILED, None)))
                elif state.phase == Phase.SMOKE:
                    event, value = rng.choice(((Event.SMOKED, None), (Event.FAILED, None)))
                elif state.phase == Phase.ROLLBACK:
                    event, value = rng.choice(((Event.ROLLED_BACK, OLD), (Event.ROLLBACK_FAILED, OLD)))
                else:
                    event, value = rng.choice(((Event.RECOVERED, None), (Event.RECOVERY_FAILED, None)))
                previous = state
                state, effects = step(state, event, value)
                history.append({'event': event, 'value': value})
                self.assertEqual(project(history), state)
                if previous.phase not in TERMINAL:
                    self.assertEqual(state.candidate, previous.candidate)
                if state.phase in (Phase.DEPLOY, Phase.SMOKE, Phase.ROLLBACK, Phase.RECOVER):
                    self.assertEqual(state.mode, 'promote')
                    self.assertEqual(state.targets, ((OLD, 'previous'),))
                if state.phase == Phase.SUCCESS and state.mode == 'promote':
                    self.assertEqual(event, Event.SMOKED)
                self.assertNotIn('restore_data', [effect for effect, _ in effects])

    def test_journal_replays_real_fsync_file_and_refuses_partial_record(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'events.jsonl'
            journal = Journal(path)
            journal.record(Event.SELECT, (SHA, 'promote'))
            journal.record(Event.BUILT, {'worker': 'digest'})
            journal.record(Event.FORWARD, [(OLD, 'previous-version')])
            self.assertEqual(Journal(path).state, journal.state)
            with path.open('a') as stream:
                stream.write('{')
            with self.assertRaises(ValueError):
                Journal(path)


class ArtifactTests(unittest.TestCase):
    def test_evidence_retains_native_browser_receipts_but_cannot_follow_host_links(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / '.last-run.json').write_text('{}')
            self.assertEqual(list(regular_tree(root)), [root / '.last-run.json'])
            (root / 'escape').symlink_to(root / '.last-run.json')
            with self.assertRaises(ValueError):
                list(regular_tree(root))

    def test_real_staging_refuses_symlinks_discovery_and_changed_config(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'source'
            source.mkdir()
            (source / 'worker.js').write_text('export default {}')
            (source / 'wrangler.json').write_text('{"no_bundle":true}')
            expected = {'no_bundle': True}
            hashes = stage_artifact(source, root / 'artifact', expected)
            self.assertEqual(hashes, tree_hashes(root / 'artifact'))
            with self.assertRaises(ValueError):
                stage_artifact(source, root / 'other', {'no_bundle': False})
            for name in ('.env', 'package.json'):
                (source / name).write_text('unexpected')
                with self.assertRaises(ValueError):
                    tree_hashes(source)
                (source / name).unlink()
            (source / 'linked').symlink_to(source / 'worker.js')
            with self.assertRaises(ValueError):
                tree_hashes(source)

    def test_expected_contract_keeps_the_existing_do_and_no_runtime_secrets(self):
        source = Path(__file__).resolve().parents[1]
        # Commit the real contract into disposable Git, also in Git-free archives.
        import subprocess

        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            (repo / 'wrangler.jsonc').write_text((source / 'wrangler.jsonc').read_text())
            subprocess.run(['git', 'init', '--quiet', str(repo)], check=True)
            subprocess.run(['git', 'add', '.'], cwd=repo, check=True)
            subprocess.run(['git', '-c', 'user.name=Native test', '-c', 'user.email=native@example.invalid', 'commit', '--quiet', '-m', 'contract'], cwd=repo, check=True)
            sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip()
            config = expected_config(repo, sha)
        self.assertEqual(config['name'], 'linejam')
        self.assertEqual(config['durable_objects']['bindings'][0]['class_name'], 'LinejamBackend')
        self.assertEqual(config['migrations'], [{'tag': 'linejam-backend-v1', 'new_sqlite_classes': ['LinejamBackend']}])
        self.assertTrue(config['no_bundle'])
        self.assertNotIn('GUEST_TOKEN_SECRET', config['vars'])
        self.assertNotIn('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY', config['vars'])


if __name__ == '__main__':
    unittest.main()
