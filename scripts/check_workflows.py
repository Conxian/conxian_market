"""Validate workflow YAML and job-output step references before jobs can run."""
import re
from pathlib import Path

import yaml


def validate(text):
    document = yaml.load(text, Loader=yaml.BaseLoader)
    if not isinstance(document, dict) or not isinstance(document.get('jobs'), dict):
        raise ValueError('workflow must contain a jobs mapping')
    for name, job in document['jobs'].items():
        step_ids = {step['id'] for step in job.get('steps', []) if 'id' in step}
        for output in job.get('outputs', {}).values():
            for step_id in re.findall(r'\bsteps\.([\w-]+)\.outputs\.', str(output)):
                if step_id not in step_ids:
                    raise ValueError(f'{name}: output references missing step {step_id}')


def main():
    paths = sorted(Path('.github/workflows').glob('*.y*ml'))
    if not paths:
        raise ValueError('no workflow files found')
    for path in paths:
        try:
            validate(path.read_text())
        except (ValueError, yaml.YAMLError) as error:
            raise SystemExit(f'{path}: {error}') from error
    print(f'Validated {len(paths)} workflow files and job-output step references')


if __name__ == '__main__':
    main()
