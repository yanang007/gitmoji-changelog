const nodeEmoji = require('node-emoji')
const groupMapping = require('./groupMapping')
const rc = require('rc')

function parseSubject(subject) {
  if (!subject) return {}

  const unemojified = nodeEmoji.unemojify(subject)

  const matches = unemojified.match(/:(\w*):(.*)/)

  if (matches) {
    const [, emojiCode, message] = matches

    if (nodeEmoji.hasEmoji(emojiCode)) {
      return {
        emojiCode,
        emoji: nodeEmoji.get(emojiCode),
        message: nodeEmoji.emojify(message.trim()),
      }
    }
  }

  return {
    message: subject,
  }
}

function getCriticalGroup() {
  const customConfiguration = rc('gitmoji-changelog')
  const customGroupMapping = customConfiguration ? customConfiguration.commitMapping : undefined
  let ret
  if (!customGroupMapping) {
    ret = groupMapping
  }
  else {
    ret = groupMapping.map(group => {
      const customGroup = customGroupMapping.find(cg => cg.group === group.group)
      return customGroup || group
    })
  }
  const criticalIndex = ret.findIndex(g => g.group === 'critical')
  if (criticalIndex >= 0) {
    return ret[criticalIndex].emojis
  }
  else {
    return []
  }
}

function getMergedGroupMapping() {
  const customConfiguration = rc('gitmoji-changelog')
  const customGroupMapping = customConfiguration ? customConfiguration.commitMapping : undefined
  let ret
  if (!customGroupMapping) {
    ret = groupMapping.filter(g => g.group !== 'critical')
  }
  else {
    const newCategories = customGroupMapping.filter(cg => {
      return !groupMapping.some(g => g.group === cg.group)
    })

    const overridedCategories = groupMapping.map(group => {
      const customGroup = customGroupMapping.find(cg => cg.group === group.group)
      return customGroup || group
    })

    const miscellaneousIndex = overridedCategories.findIndex(g => g.group === 'misc')
    const miscellaneousCategory = overridedCategories.splice(miscellaneousIndex, 1)[0]

    const criticalIndex = overridedCategories.findIndex(g => g.group === 'critical')
    if (criticalIndex !== -1) {
    overridedCategories.splice(criticalIndex, 1)
    }

    ret = [
      ...overridedCategories,
      ...newCategories,
      miscellaneousCategory,
    ]
  }
  return ret
}

function getCommitGroup(emojiCode) {
  const group = getMergedGroupMapping()
    .find(({ emojis }) => emojis.includes(emojiCode))
  if (!group) return 'misc'
  return group.group
}

function parseCommit({
  hash, author, date, subject = '', body = '',
}) {
  if (!Array.isArray(body)) {
    body = [body]
  }
  const content = [subject, ...body]

  const ret = []
  content.map(subject => {
    const { emoji, emojiCode, message } = parseSubject(subject)

    if (ret.length < 1 || getCriticalGroup().includes(emojiCode)) {
      const group = getCommitGroup(emojiCode)

      ret.push({
        hash,
        author,
        date,
        subject,
        emojiCode,
        emoji,
        message,
        group,
        siblings: [],
        body: body.join('\n'),
      })
    }
  })
  return ret
}

module.exports = {
  parseCommit,
  getCommitGroup,
  getMergedGroupMapping,
}
