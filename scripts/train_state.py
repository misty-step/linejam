"""Copied native Overmind reducer: decisions and replay have no deployment I/O."""
from dataclasses import dataclass, replace
from enum import StrEnum
import json
import os
import re
from typing import Any


class Phase(StrEnum):
    IDLE = 'idle'
    BUILD = 'build'
    FORWARD = 'forward'
    DEPLOY = 'deploy'
    SMOKE = 'smoke'
    ROLLBACK = 'rollback'
    RECOVER = 'recover'
    SUCCESS = 'success'
    FAILED = 'failed'
    ESCALATED = 'escalated'
    SKIPPED = 'skipped'


TERMINAL = (Phase.IDLE, Phase.SUCCESS, Phase.FAILED, Phase.ESCALATED, Phase.SKIPPED)


class Event(StrEnum):
    SELECT = 'select'
    BUILT = 'built'
    FORWARD = 'forward'
    DEPLOYED = 'deployed'
    SMOKED = 'smoked'
    FAILED = 'failed'
    ROLLED_BACK = 'rolled_back'
    ROLLBACK_FAILED = 'rollback_failed'
    RECOVERED = 'recovered'
    RECOVERY_FAILED = 'recovery_failed'


class Effect(StrEnum):
    BUILD = 'build'
    FORWARD = 'forward'
    DEPLOY = 'deploy'
    SMOKE = 'smoke'
    ROLLBACK = 'rollback'
    RECOVER = 'recover'
    REPORT = 'report'


@dataclass(frozen=True)
class State:
    phase: Phase = Phase.IDLE
    candidate: str = 'unselected'
    mode: str = 'verify'
    last: tuple = ()
    hashes: tuple = ()
    targets: tuple = ()
    attempted: int = 0
    remaining: tuple = ()
    rollback_failures: tuple = ()


def finish(state, phase):
    last = dict(state.last)
    if state.mode != 'diagnostic':
        last[state.mode] = (state.candidate, phase)
    return replace(state, phase=phase, last=tuple(sorted(last.items())))


def step(state, event, value: Any = None):
    if event == Event.SELECT:
        sha, mode = value
        if not re.fullmatch('[0-9a-f]{40}', sha) or mode not in ('promote', 'verify', 'diagnostic'):
            raise ValueError('Invalid native candidate event')
        if state.phase not in TERMINAL:
            raise ValueError('Unfinished native attempt must recover before selection')
        if mode != 'diagnostic' and dict(state.last).get(mode, (None, None))[0] == sha:
            return replace(state, phase=Phase.SKIPPED, candidate=sha, mode=mode), ()
        return State(Phase.BUILD, sha, mode, state.last), ((Effect.BUILD, None),)
    if event == Event.BUILT and state.phase == Phase.BUILD:
        state = replace(state, hashes=tuple(sorted(value.items())))
        if state.mode == 'promote':
            return replace(state, phase=Phase.FORWARD), ((Effect.FORWARD, None),)
        return finish(state, Phase.SUCCESS), ()
    if event == Event.FORWARD and state.phase == Phase.FORWARD:
        targets = tuple(tuple(target) for target in value)
        if not targets or len({name for name, _ in targets}) != len(targets):
            raise ValueError('Invalid native target snapshots')
        return replace(state, phase=Phase.DEPLOY, targets=targets, attempted=1), ((Effect.DEPLOY, targets[0][0]),)
    if event == Event.DEPLOYED and state.phase == Phase.DEPLOY and value == state.targets[state.attempted-1][0]:
        if state.attempted < len(state.targets):
            target = state.targets[state.attempted][0]
            return replace(state, attempted=state.attempted+1), ((Effect.DEPLOY, target),)
        return replace(state, phase=Phase.SMOKE), ((Effect.SMOKE, None),)
    if event == Event.SMOKED and state.phase == Phase.SMOKE:
        return finish(state, Phase.SUCCESS), ()
    if event == Event.FAILED:
        if state.phase in (Phase.BUILD, Phase.FORWARD):
            return finish(state, Phase.FAILED), ((Effect.REPORT, None),)
        if state.phase in (Phase.DEPLOY, Phase.SMOKE):
            remaining = tuple(name for name, _ in reversed(state.targets[:state.attempted]))
            return replace(state, phase=Phase.ROLLBACK, remaining=remaining), ((Effect.ROLLBACK, remaining[0]),)
    if event in (Event.ROLLED_BACK, Event.ROLLBACK_FAILED) and state.phase == Phase.ROLLBACK and value == state.remaining[0]:
        failures = state.rollback_failures + ((value,) if event == Event.ROLLBACK_FAILED else ())
        remaining = state.remaining[1:]
        state = replace(state, remaining=remaining, rollback_failures=failures)
        if remaining:
            return state, ((Effect.ROLLBACK, remaining[0]),)
        if failures:
            return finish(state, Phase.ESCALATED), ((Effect.REPORT, None),)
        return replace(state, phase=Phase.RECOVER), ((Effect.RECOVER, None),)
    if event == Event.RECOVERED and state.phase == Phase.RECOVER:
        return finish(state, Phase.FAILED), ((Effect.REPORT, None),)
    if event == Event.RECOVERY_FAILED and state.phase == Phase.RECOVER:
        return finish(state, Phase.ESCALATED), ((Effect.REPORT, None),)
    raise ValueError('Invalid native transition: '+state.phase+' / '+event)


def project(events):
    state = State()
    for record in events:
        state, _ = step(state, Event(record['event']), record.get('value'))
    return state


class Journal:
    """The existing native lock owns this append-only file; persist before effects."""
    def __init__(self, path):
        self.path = path
        text = path.read_text() if path.exists() else ''
        if text and not text.endswith('\n'):
            raise ValueError('Incomplete native event log; preserve recovery evidence')
        self.state = project(json.loads(line) for line in text.splitlines())

    def record(self, event, value: Any = None):
        state, effects = step(self.state, event, value)
        created = not self.path.exists()
        with self.path.open('a') as stream:
            stream.write(json.dumps({'event': event, 'value': value}, separators=(',', ':'))+'\n')
            stream.flush()
            os.fsync(stream.fileno())
        if created:
            directory = os.open(self.path.parent, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
        self.state = state
        return effects
