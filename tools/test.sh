#!/bin/sh
# Copyright 2026 Marko Milivojevic
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Run unit tests using Node.js built-in test runner.
# Usage: ./tools/test.sh [file...]
#   No args = run all tests
#   With args = run specific test files
#
# Examples:
#   ./tools/test.sh                          # all tests
#   ./tools/test.sh tests/game.test.js       # single file
#   ./tools/test.sh tests/game.test.js tests/config.test.js  # multiple files

set -e

cd "$(dirname "$0")/.."

if [ $# -eq 0 ]; then
    exec node --test tests/*.test.js
else
    exec node --test "$@"
fi
