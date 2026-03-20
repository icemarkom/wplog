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

import { describe, it } from "node:test";
import { strictEqual } from "node:assert";
import { escapeHTML } from "../js/sanitize.js";

describe("escapeHTML", () => {
    it("escapes ampersand", () => {
        strictEqual(escapeHTML("A & B"), "A &amp; B");
    });

    it("escapes less-than", () => {
        strictEqual(escapeHTML("<script>"), "&lt;script&gt;");
    });

    it("escapes greater-than", () => {
        strictEqual(escapeHTML("a > b"), "a &gt; b");
    });

    it("escapes double quotes", () => {
        strictEqual(escapeHTML('say "hello"'), "say &quot;hello&quot;");
    });

    it("escapes single quotes", () => {
        strictEqual(escapeHTML("it's"), "it&#39;s");
    });

    it("escapes all special chars together", () => {
        strictEqual(escapeHTML(`<img src="x" onerror='alert(1)' & more>`),
            "&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39; &amp; more&gt;");
    });

    it("passes through safe strings unchanged", () => {
        strictEqual(escapeHTML("Newport Harbor"), "Newport Harbor");
    });

    it("passes through empty string", () => {
        strictEqual(escapeHTML(""), "");
    });

    it("converts numbers to string", () => {
        strictEqual(escapeHTML(42), "42");
    });

    it("converts null to string 'null'", () => {
        strictEqual(escapeHTML(null), "null");
    });

    it("converts undefined to string 'undefined'", () => {
        strictEqual(escapeHTML(undefined), "undefined");
    });

    it("handles cap numbers with modifiers", () => {
        strictEqual(escapeHTML("1A"), "1A");
        strictEqual(escapeHTML("1B"), "1B");
        strictEqual(escapeHTML("1C"), "1C");
    });

    it("handles unicode in team names", () => {
        strictEqual(escapeHTML("Malmö HK"), "Malmö HK");
    });
});
