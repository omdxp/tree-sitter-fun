# tree-sitter-fun

[Tree-sitter](https://tree-sitter.github.io) grammar for [Fun](https://github.com/omdxp/fun).

It parses every `.fn` file in the Fun repository (standard library, compiler, examples) without errors.

## Usage

```sh
npm install -g tree-sitter-cli
tree-sitter generate
tree-sitter parse path/to/file.fn
tree-sitter test
```

`queries/` holds highlights, brackets, indents, outline, text objects, injections and runnables.

## Notes

- `Point* p;` and `a * b;` are ambiguous at statement level. The grammar reads them as a declaration.
- `iN`/`uN` integer types parse as ordinary type identifiers. `highlights.scm` marks them as builtin types.

## License

MIT
