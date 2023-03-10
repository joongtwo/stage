/* eslint-env node*/
// https://eslint.org/docs/rules/
module.exports = {
    extends: [ '@swf/eslint-config-swf' ],
    overrides: [ {
        files: [
            '*.js'
        ],
        rules: {
            '@swf/swf/require-copyright': 0,
            'array-bracket-spacing': 0,
            'block-spacing': 0,
            'brace-style': 0,
            'class-methods-use-this': 0,
            'comma-dangle': 0,
            'comma-spacing': 0,
            'comma-style': 0,
            'complexity': 0,
            'consistent-return': 0,
            'consistent-this': 0,
            'curly': 0,
            'dot-location': 0,
            'dot-notation': 0,
            'eol-last': 0,
            'eqeqeq': 0,
            'func-call-spacing': 0,
            'func-name-matching': 0,
            'indent': 0,
            'jsx-quotes': 0,
            'max-depth': 0,
            'max-len': 0,
            'max-lines': 0,
            'max-nested-callbacks': 0,
            'max-statements-per-line': 0,
            'new-cap': 0,
            'new-parens': 0,
            'no-alert': 0,
            'no-array-constructor': 0,
            'no-bitwise': 0,
            'no-caller': 0,
            'no-case-declarations': 0,
            'no-console': 0,
            'no-delete-var': 0,
            'no-div-regex': 0,
            'no-else-return': 0,
            'no-empty': 0,
            'no-empty-function': 0,
            'no-eq-null': 0,
            'no-eval': 0,
            'no-extend-native': 0,
            'no-extra-bind': 0,
            'no-extra-boolean-cast': 0,
            'no-extra-label': 0,
            'no-extra-parens': 0,
            'no-extra-semi': 0,
            'no-floating-decimal': 0,
            'no-global-assign': 0,
            'no-implicit-coercion': 0,
            'no-implicit-globals': 0,
            'no-implied-eval': 0,
            'no-invalid-this': 0,
            'no-iterator': 0,
            'no-multi-assign': 0,
            'no-multiple-empty-lines': 0,
            'no-multi-str': 0,
            'nonblock-statement-body-position': 0,
            'no-nested-ternary': 0,
            'no-octal': 0,
            'no-proto': 0,
            'no-redeclare': 0,
            'no-regex-spaces': 0,
            'no-restricted-globals': 0,
            'no-restricted-syntax': 0,
            'no-script-url': 0,
            'no-sequences': 0,
            'no-shadow-restricted-names': 0,
            'no-tabs': 0,
            'no-trailing-spaces': 0,
            'no-unneeded-ternary': 0,
            'no-unused-labels': 0,
            'no-useless-catch': 0,
            'no-useless-escape': 0,
            'no-whitespace-before-property': 0,
            'no-with': 0,
            'object-curly-spacing': 0,
            'one-var': 0,
            'one-var-declaration-per-line': 0,
            'operator-assignment': 0,
            'padded-blocks': 0,
            'quote-props': 0,
            'quotes': 0,
            'require-yield': 0,
            'semi': 0,
            'semi-spacing': 0,
            'sonarjs/cognitive-complexity': 0,
            'sonarjs/max-switch-cases': 0,
            'sonarjs/no-all-duplicated-branches': 0,
            'sonarjs/no-collapsible-if': 0,
            'sonarjs/no-collection-size-mischeck': 0,
            'sonarjs/no-duplicated-branches': 0,
            'sonarjs/no-duplicate-string': 0,
            'sonarjs/no-element-overwrite': 0,
            'sonarjs/no-extra-arguments': 0,
            'sonarjs/no-identical-conditions': 0,
            'sonarjs/no-identical-expressions': 0,
            'sonarjs/no-identical-functions': 0,
            'sonarjs/no-inverted-boolean-check': 0,
            'sonarjs/no-one-iteration-loop': 0,
            'sonarjs/no-redundant-boolean': 0,
            'sonarjs/no-redundant-jump': 0,
            'sonarjs/no-same-line-conditional': 0,
            'sonarjs/no-small-switch': 0,
            'sonarjs/no-unused-collection': 0,
            'sonarjs/no-useless-catch': 0,
            'sonarjs/no-use-of-empty-return-value': 0,
            'sonarjs/prefer-immediate-return': 0,
            'sonarjs/prefer-single-boolean-return': 0,
            'sonarjs/prefer-while': 0,
            'space-before-blocks': 0,
            'space-before-function-paren': 0,
            'space-infix-ops': 0,
            'space-in-parens': 0,
            'space-unary-ops': 0,
            'template-tag-spacing': 0,
            'unicode-bom': 0,
        }
    } ],
    reportUnusedDisableDirectives: true
};