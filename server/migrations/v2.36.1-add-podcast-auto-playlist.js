/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.36.1'
const migrationName = `${migrationVersion}-add-podcast-auto-playlist`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * Adds the autoAddToPlaylistIds column (JSON array of playlist UUIDs) to the podcasts table.
 * Newly downloaded episodes for a podcast can be auto-added to one or more playlists.
 *
 * @param {MigrationOptions} options
 * @returns {Promise<void>}
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (!(await queryInterface.tableExists('podcasts'))) {
    logger.info(`${loggerPrefix} podcasts table does not exist`)
    logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
    return
  }

  const tableDescription = await queryInterface.describeTable('podcasts')

  if (!tableDescription.autoAddToPlaylistIds) {
    logger.info(`${loggerPrefix} Adding autoAddToPlaylistIds column to podcasts table`)
    await queryInterface.addColumn('podcasts', 'autoAddToPlaylistIds', {
      type: queryInterface.sequelize.Sequelize.DataTypes.TEXT,
      allowNull: true,
      defaultValue: null
    })
  } else {
    logger.info(`${loggerPrefix} autoAddToPlaylistIds column already exists`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * @param {MigrationOptions} options
 * @returns {Promise<void>}
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (!(await queryInterface.tableExists('podcasts'))) {
    logger.info(`${loggerPrefix} podcasts table does not exist`)
    logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
    return
  }

  const tableDescription = await queryInterface.describeTable('podcasts')

  if (tableDescription.autoAddToPlaylistIds) {
    logger.info(`${loggerPrefix} Removing autoAddToPlaylistIds column from podcasts table`)
    await queryInterface.removeColumn('podcasts', 'autoAddToPlaylistIds')
  } else {
    logger.info(`${loggerPrefix} autoAddToPlaylistIds column does not exist, skipping`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
