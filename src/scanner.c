// External scanner: tells a ternary `?` apart from the postfix
// propagation `?`. Both are the same character, and a context-free grammar
// cannot settle `ok ? -1 : 1` versus `(ok?) - 1` without seeing the `:`.
// Mirrors the Fun compiler's own `looks_like_ternary_branch`: a `?` starts
// a ternary when a `:` appears at bracket depth 0 before the surrounding
// context ends (a depth-0 `;`, `,` or `{`, or an unmatched closer).

#include "tree_sitter/parser.h"

#include <stdbool.h>

enum TokenType {
  TERNARY_QUESTION,
};

void *tree_sitter_fun_external_scanner_create(void) { return NULL; }
void tree_sitter_fun_external_scanner_destroy(void *payload) { (void)payload; }
unsigned tree_sitter_fun_external_scanner_serialize(void *payload, char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}
void tree_sitter_fun_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

static void advance(TSLexer *lexer) { lexer->advance(lexer, false); }
static void skip(TSLexer *lexer) { lexer->advance(lexer, true); }

static void skip_quoted(TSLexer *lexer, int32_t quote) {
  advance(lexer);
  while (!lexer->eof(lexer) && lexer->lookahead != quote) {
    if (lexer->lookahead == '\\' && quote != '`') {
      advance(lexer);
      if (lexer->eof(lexer)) {
        return;
      }
    } else if (lexer->lookahead == '\n' && quote != '`') {
      return;
    }
    advance(lexer);
  }
  if (!lexer->eof(lexer)) {
    advance(lexer);
  }
}

static bool scan_ternary_question(TSLexer *lexer) {
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r' ||
         lexer->lookahead == '\n') {
    skip(lexer);
  }
  if (lexer->lookahead != '?') {
    return false;
  }
  advance(lexer);
  // `?!` is its own operator (`?!(err)` propagation), lexed as one token.
  if (lexer->lookahead == '!') {
    return false;
  }
  lexer->mark_end(lexer);
  lexer->result_symbol = TERNARY_QUESTION;

  int depth = 0;
  for (int steps = 0; steps < 1 << 16; steps++) {
    if (lexer->eof(lexer)) {
      return false;
    }
    int32_t c = lexer->lookahead;
    if (c == '"' || c == '\'' || c == '`') {
      skip_quoted(lexer, c);
      continue;
    }
    if (c == '/') {
      advance(lexer);
      if (lexer->lookahead == '/') {
        while (!lexer->eof(lexer) && lexer->lookahead != '\n') {
          advance(lexer);
        }
      } else if (lexer->lookahead == '*') {
        advance(lexer);
        int32_t prev = 0;
        while (!lexer->eof(lexer) && !(prev == '*' && lexer->lookahead == '/')) {
          prev = lexer->lookahead;
          advance(lexer);
        }
        if (!lexer->eof(lexer)) {
          advance(lexer);
        }
      }
      continue;
    }
    if (c == '{' && depth == 0) {
      return false;
    }
    if (c == '(' || c == '[' || c == '{') {
      depth++;
      advance(lexer);
      continue;
    }
    if (c == ')' || c == ']' || c == '}') {
      if (depth == 0) {
        return false;
      }
      depth--;
      advance(lexer);
      continue;
    }
    if (depth == 0) {
      if (c == ';' || c == ',') {
        return false;
      }
      if (c == ':') {
        advance(lexer);
        // `::` is its own operator, never a ternary separator.
        if (lexer->lookahead == ':') {
          advance(lexer);
          continue;
        }
        return true;
      }
    }
    advance(lexer);
  }
  return false;
}

bool tree_sitter_fun_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  (void)payload;
  if (!valid_symbols[TERNARY_QUESTION]) {
    return false;
  }
  return scan_ternary_question(lexer);
}
