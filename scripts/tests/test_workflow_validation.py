import importlib.util
from pathlib import Path
import unittest

import yaml

spec = importlib.util.spec_from_file_location(
    'check_workflows', Path(__file__).parents[1] / 'check_workflows.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class WorkflowValidationTests(unittest.TestCase):
    def test_invalid_permissions_is_rejected_before_execution(self):
        with self.assertRaises(yaml.YAMLError):
            checker.validate('permissions: contents: read\njobs: {}\n')

    def test_dangling_job_output_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'missing step missing'):
            checker.validate('''jobs:
  create:
    outputs:
      db_url: ${{ steps.missing.outputs.db_url }}
    steps:
      - id: create
        run: echo fixture
''')

    def test_valid_hyphenated_step_and_unrelated_needs_reference(self):
        checker.validate('''permissions:
  contents: read
jobs:
  create:
    outputs:
      db_url: ${{ steps.create-branch.outputs.db_url }}
      inherited: ${{ needs.setup.outputs.branch }}
    steps:
      - id: create-branch
        run: echo fixture
''')


if __name__ == '__main__':
    unittest.main()
