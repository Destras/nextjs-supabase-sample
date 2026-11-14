module.exports = {
  // Format every staged file with Prettier, except anything under `.docs/`
  // (design mockups, screenshots, exported HTML) which must not be touched
  // by the pre-commit hook.
  '*': (stagedFiles) => {
    const files = stagedFiles.filter((file) => !file.includes('/.docs/'))
    if (files.length === 0) return []
    const list = files.map((file) => JSON.stringify(file)).join(' ')
    return `prettier --ignore-unknown --write ${list}`
  },
}
