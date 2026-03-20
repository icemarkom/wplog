// Copyright 2026 Marko Milivojevic
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// wplog — Browser Test Harness
// Minimal test runner matching node:test / node:assert API.
// Usage: import { describe, it, strictEqual, ok, runTests } from "./harness.js";

const suites = [];
let currentSuite = null;

export function describe(name, fn) {
    const parent = currentSuite;
    const suite = { name, tests: [], children: [], parent };
    if (parent) {
        parent.children.push(suite);
    } else {
        suites.push(suite);
    }
    currentSuite = suite;
    fn();
    currentSuite = parent;
}

export function it(name, optionsOrFn, maybeFn) {
    let fn, options = {};
    if (typeof optionsOrFn === "function") {
        fn = optionsOrFn;
    } else {
        options = optionsOrFn || {};
        fn = maybeFn;
    }
    if (!currentSuite) throw new Error("it() must be inside describe()");
    currentSuite.tests.push({ name, fn, todo: options.todo });
}

// ── Assertions ───────────────────────────────────────────────

export function strictEqual(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error(msg || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

export function deepStrictEqual(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
        throw new Error(msg || `Expected ${e}, got ${a}`);
    }
}

export function ok(value, msg) {
    if (!value) {
        throw new Error(msg || `Expected truthy value, got ${JSON.stringify(value)}`);
    }
}

// ── Runner ───────────────────────────────────────────────────

export async function runTests() {
    const results = { pass: 0, fail: 0, todo: 0, total: 0 };
    const output = document.getElementById("test-results");
    const sandbox = document.getElementById("test-sandbox");
    if (!output) throw new Error("Missing #test-results element");

    async function runSuite(suite, depth) {
        const header = document.createElement("div");
        header.className = "suite";
        header.style.paddingLeft = `${depth * 1.2}rem`;
        header.textContent = suite.name;
        output.appendChild(header);

        for (const test of suite.tests) {
            results.total++;
            const row = document.createElement("div");
            row.style.paddingLeft = `${(depth + 1) * 1.2}rem`;

            if (test.todo) {
                results.todo++;
                row.className = "todo";
                row.textContent = `⚠ ${test.name} # ${test.todo}`;
                console.warn(`⚠ ${suite.name} > ${test.name} # ${test.todo}`);
            } else {
                try {
                    await test.fn();
                    results.pass++;
                    row.className = "pass";
                    row.textContent = `✔ ${test.name}`;
                } catch (err) {
                    results.fail++;
                    row.className = "fail";
                    row.textContent = `✖ ${test.name} — ${err.message}`;
                    console.error(`✖ ${suite.name} > ${test.name}`, err);
                }
            }

            output.appendChild(row);

            // Clear sandbox between tests
            if (sandbox) sandbox.innerHTML = "";
        }

        for (const child of suite.children) {
            await runSuite(child, depth + 1);
        }
    }

    for (const suite of suites) {
        await runSuite(suite, 0);
    }

    // Summary
    const summary = document.createElement("div");
    summary.className = "summary";
    const status = results.fail > 0 ? "fail" : "pass";
    summary.innerHTML = `<span class="${status}">${results.total} tests, ${results.pass} pass, ${results.fail} fail, ${results.todo} todo</span>`;
    output.appendChild(summary);

    console.log(`\n${results.total} tests, ${results.pass} pass, ${results.fail} fail, ${results.todo} todo`);

    return results;
}
