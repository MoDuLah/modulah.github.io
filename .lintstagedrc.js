module.exports = {
  '*.{js,mjs}': ['eslint --fix', 'prettier --write'],
  '*.{css,scss}': ['stylelint --fix', 'prettier --write'],
  '*.{html,htm}': ['htmlhint', 'prettier --write'],
  '*.{json,md}': ['prettier --write']
};
