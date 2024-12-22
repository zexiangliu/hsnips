# H-Snips
![](./images/welcome.gif)

H-Snips is a fork of [HyperSnips V2](https://github.com/Oskar-Idland/hsnips). The credits belong to 
[Oskar-Idland](https://github.com/Oskar-Idland/hsnips), [OrangeX4](https://github.com/OrangeX4/hsnips), and [draivin](https://github.com/draivin/hsnips). Since I am not a fan of noodle versioning (V1, V2, V3, etc.), I rename the package as H-Snips.

Key improvements compared with HyperSnips:

- Fixed bugs with [Vim extension](https://marketplace.visualstudio.com/items?itemName=vscodevim.vim). 
- Support using with [Vim extension](https://marketplace.visualstudio.com/items?itemName=vscodevim.vim) and [Overleaf Workshop](https://github.com/iamhyc/Overleaf-Workshop) together now!
- Support organzing snippets by extension names. For instance, you can put your snippets for `.tex` files in `tex.snippet` instead of `latext.snippet`.

## Table of Contents
- [H-Snips](#h-snips)
  - [Table of Contents](#table-of-contents)
  - [Quick Start](#quick-start)
    - [Syntax and Flags](#syntax-and-flags)
    - [Tabstops and Placeholders](#tabstops-and-placeholders)
    - [Regex and Priority](#regex-and-priority)
    - [Return Value and JavaScript](#return-value-and-javascript)
    - [Visual Selection](#visual-selection)
    - [Example Config](#example-config)
  - [Detailed Usage](#detailed-usage)
    - [Snippets file](#snippets-file)
    - [Trigger](#trigger)
    - [Flags](#flags)
    - [Snippet body](#snippet-body)
    - [Code interpolation](#code-interpolation)
  - [Additional Examples](#additional-examples)

## Quick Start
Press `Ctrl + Shift + P`, and choose `Open Snippets Directory`, then create a `mk.hsnips` or `markdown.hsnips` file, for your markdown snippets. Substitute "mk" or "markdown" for **whatever file extension or language you want**. You can also create a `all.hsnips` file for snippets that should be available in all languages. 

### Syntax and Flags
Here is an example of a snippet that will expand to `\mathbb{R}` when you type `RR` in a math environment:
```lua
snippet RR "R" iAm
\mathbb{R}
endsnippet
```
There are three flags in this snippet: `i`, `A`, and `m`. `i` allows the snippet to be triggered in the middle of a word, `A` allows the snippet to be triggered automatically, and `m` specifies that the snippet should only be triggered in a math environment.

### Tabstops and Placeholders 
Tabstops are used to define where the cursor should go after the snippet is expanded. Pressing `Tab` will move the cursor to the next tabstop. Here is an example of a snippet that will expand to a table environment with a caption and a label:
```lua
snippet tabular "tabular" wA
\begin{table}[${1:h!}]
  \centering
  $0
  \caption{$2}
  \label{tab: $3}
\end{table}
endsnippet
```
The cursor begins at the first tabstop, `${1:h!}`. Here `h!` is the default value, but will be overwritten by typing. By pressing `Tab`, the cursor will move to the next tabstop, `${2}`. The cursor will then move to `${3}`. The final tabstop is `$0`, which is inside the table environment.

Nested tabstops are supported, meaning you can use snippets inside snippets!
                                      

### Regex and Priority
Here is another example of a snippet that will postfix any word, putting it in the bold font:
```lua
priority 100
snippet `(\\?[a-zA-Z]\w*({?\w*})?)(bf|BF)` "mathbf" iAm
\mathbf{``rv = m[1]``}
endsnippet
```
Priority is set to 100, so that if two snippets match sometimes, this will be prioritized. You can have many different priorities. 

### Return Value and JavaScript
We can manipulate our snippets further with return values: `rv = m[1]`. In this case, `m[1]` is the first match group of the regex trigger. We can use JavaScript to manipulate this string before it is inserted. Here we use it to uppercase the letter to be put in the math font. 

```lua
priority 100
snippet `(\\?[a-zA-Z]\w*({?\w*})?)cal` "mathcal" iAm
\mathcal{``rv = m[1].toUpperCase()``}$0
endsnippet
```

### Visual Selection
With the VISUAL keyword, we can insert what was selected, before typing the trigger. Here is an example of a snippet that will expand to a fraction with the selected text as the numerator:
```lua
snippet fr "frac" iAm
\\frac{${1:${VISUAL}}}{$2}
endsnippet
```

### Example Config
Oskar's snippet file, `latex.hsnips`, is made for math/physics and can be found [here](https://github.com/Oskar-Idland/vscode/blob/main/latex.hsnips). 

---
## Detailed Usage 

H-Snips is a snippet engine for vscode heavily inspired by vim's
[UltiSnips](https://github.com/SirVer/ultisnips).


To use H-Snips you create `.hsnips` files on a directory which depends on your platform:

- Windows: `%APPDATA%\Code\User\hsnips\(language).hsnips`
- Mac: `$HOME/Library/Application Support/Code/User/hsnips/(language).hsnips`
- Linux: `$HOME/.config/Code/User/hsnips/(language).hsnips`

Or alternatively, you can open this directory by running the command `H-Snips: Open snippets directory`.

Additionally, you can create an `all.hsnips` file for snippets that should be available on all languages.

### Snippets file

A snippets file is a file with the `.hsnips` extension, the file is composed of two types of blocks:
global blocks and snippet blocks.

Global blocks are JavaScript code blocks with code that is shared between all the snippets defined
in the current file. They are defined with the `global` keyword, as follows:

```js
global
// JavaScript code
endglobal
```

Snippet blocks are snippet definitions. They are defined with the `snippet` keyword, as follows:

```lua
snippet trigger "description" flags
body
endsnippet
```

where the `trigger` field is required and the fields `description` and `flags` are optional.

### Trigger

A trigger can be any sequence of characters which does not contain a space, or a regular expression
surrounded by backticks (`` ` ``).

### Flags

The flags field is a sequence of characters which modify the behavior of the snippet, the available
flags are the following:

- `A`: Automatic snippet expansion - Usually snippets are activated when the `tab` key is pressed,
  with the `A` flag snippets will activate as soon as their trigger matches, it is specially useful
  for regex snippets.

- `i`: In-word expansion\* - By default, a snippet trigger will only match when the trigger is
  preceded by whitespace characters. A snippet with this option is triggered regardless of the
  preceding character, for example, a snippet can be triggered in the middle of a word.

- `w`: Word boundary\* - With this option the snippet trigger will match when the trigger is a word
  boundary character. Use this option, for example, to permit expansion where the trigger follows
  punctuation without expanding suffixes of larger words.

- `b`: Beginning of line expansion\* - A snippet with this option is expanded only if the
  tab trigger is the first word on the line. In other words, if only whitespace precedes the tab
  trigger, expand.

- `M`: Multi-line mode - By default, regex matches will only match content on the current line, when
  this option is enabled the last `hsnips.multiLineContext` lines will be available for matching.

- `m`: Math mode

- `h`: Hidden snippet - *Requires `A` flag*. By default, all non-regex snippets will be listed by 
  the inline suggestions. This `h` flag hides the snippet from the inline suggestions.

\*: This flag will only affect snippets which have non-regex triggers.

### Snippet body

The body is the text that will replace the trigger when the snippet is expanded, as in usual
snippets, the tab stops `$1`, `$2`, etc. are available.

The full power of H-Snips comes when using JavaScript interpolation: you can have code blocks
inside your snippet delimited by two backticks (` `` `) that will run when the snippet is expanded,
and every time the text in one of the tab stops is changed.

### Code interpolation

Inside the code interpolation, you have access to a few special variables:

- `rv`: The return value of your code block, the value of this variable will replace the code block
  when the snippet is expanded.
- `t`: An array containing the text within the tab stops, in the same order as the tab stops are
  defined in the snippet block. You can use it to dynamically change the snippet content.
- `m`: An array containing the match groups of your regular expression trigger, or an empty array if
  the trigger is not a regular expression.
- `w`: A URI string of the currently opened workspace, or an empty string if no workspace is open.
- `path`: A URI string of the current document. (untitled documents have the scheme `untitled`)

Additionally, every variable defined in one code block will be available in all the subsequent code
blocks in the snippet.

The `require` function can also be used to import NodeJS modules.

## Additional Examples

- Simple snippet which greets you with the current date and time

```lua
snippet dategreeting "Gives you the current date!"
Hello from your hsnip at ``rv = new Date().toDateString()``!
endsnippet
```

- Box snippet as shown in the gif above

```lua
snippet box "Box" A
``rv = '┌' + '─'.repeat(t[0].length + 2) + '┐'``
│ $1 │
``rv = '└' + '─'.repeat(t[0].length + 2) + '┘'``
endsnippet
```

- Snippet to insert the current filename

```lua
snippet filename "Current Filename"
``rv = require('path').basename(path)``
endsnippet
```
