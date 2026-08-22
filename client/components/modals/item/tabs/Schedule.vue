<template>
  <div class="w-full h-full relative">
    <div id="scheduleWrapper" class="w-full overflow-y-auto px-2 py-4 md:px-6 md:py-6">
      <template v-if="!feedUrl">
        <widgets-alert type="warning" class="text-base mb-4">{{ $strings.ToastPodcastNoRssFeed }}</widgets-alert>
      </template>
      <template v-if="feedUrl || autoDownloadEpisodes">
        <div class="flex items-center justify-between mb-4">
          <p class="text-base md:text-xl font-semibold">{{ $strings.HeaderScheduleEpisodeDownloads }}</p>
          <ui-checkbox v-model="enableAutoDownloadEpisodes" :label="$strings.LabelEnable" medium checkbox-bg="bg" label-class="pl-2 text-base md:text-lg" />
        </div>

        <div v-if="enableAutoDownloadEpisodes" class="flex items-center py-2">
          <ui-text-input ref="maxEpisodesInput" type="number" v-model="newMaxEpisodesToKeep" no-spinner :padding-x="1" text-center class="w-10 text-base" @change="updatedMaxEpisodesToKeep" />
          <ui-tooltip :text="$strings.LabelMaxEpisodesToKeepHelp">
            <p class="pl-4 text-base">
              {{ $strings.LabelMaxEpisodesToKeep }}
              <span class="material-symbols icon-text">info</span>
            </p>
          </ui-tooltip>
        </div>
        <div v-if="enableAutoDownloadEpisodes" class="flex items-center py-2">
          <ui-text-input ref="maxEpisodesToDownloadInput" type="number" v-model="newMaxNewEpisodesToDownload" no-spinner :padding-x="1" text-center class="w-10 text-base" @change="updateMaxNewEpisodesToDownload" />
          <ui-tooltip :text="$strings.LabelUseZeroForUnlimited">
            <p class="pl-4 text-base">
              {{ $strings.LabelMaxEpisodesToDownloadPerCheck }}
              <span class="material-symbols icon-text">info</span>
            </p>
          </ui-tooltip>
        </div>

        <widgets-cron-expression-builder ref="cronExpressionBuilder" v-if="enableAutoDownloadEpisodes" v-model="cronExpression" />
      </template>

      <div class="mt-6 pt-6 border-t border-white/10">
        <p class="text-base md:text-xl font-semibold mb-4">{{ $strings.HeaderAutoAddToPlaylist }}</p>
        <div class="flex items-center gap-3">
          <div class="relative w-64" v-click-outside="closePlaylistMenu">
            <button @click="playlistMenuOpen = !playlistMenuOpen" :disabled="loadingPlaylists" class="w-full flex items-center justify-between gap-2 text-sm px-3 py-2 border border-gray-500 rounded hover:border-gray-400 text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <span class="truncate">{{ selectedPlaylistLabel }}</span>
              <span class="material-symbols text-sm shrink-0">{{ playlistMenuOpen ? 'expand_less' : 'expand_more' }}</span>
            </button>
            <ul v-show="playlistMenuOpen" class="absolute z-20 left-0 mt-1 w-full bg-bg border border-gray-600 rounded shadow-lg text-sm py-1 max-h-48 overflow-y-auto">
              <li v-if="!playlists.length && !loadingPlaylists" class="px-3 py-1.5 text-gray-400 italic">
                {{ $strings.MessageNoUserPlaylists }}
              </li>
              <li
                v-for="playlist in playlists"
                :key="playlist.id"
                @click="togglePlaylist(playlist.id)"
                class="px-3 py-1.5 cursor-pointer hover:bg-white/5 flex items-center gap-2 text-gray-200"
              >
                <ui-checkbox :value="newAutoAddToPlaylistIds.includes(playlist.id)" @input="togglePlaylist(playlist.id)" checkbox-bg="bg" small />
                <span class="truncate">{{ playlist.name }}</span>
              </li>
            </ul>
          </div>
          <p class="text-sm text-gray-400">{{ $strings.LabelAutoAddToPlaylistHelp }}</p>
        </div>
      </div>
    </div>

    <div v-if="feedUrl || autoDownloadEpisodes" class="absolute bottom-0 left-0 w-full py-2 md:py-4 bg-bg border-t border-white/5">
      <div class="flex items-center px-2 md:px-4">
        <div class="grow" />
        <ui-btn @click="save" :disabled="!isUpdated" :color="isUpdated ? 'bg-success' : 'bg-primary'" class="mx-2">{{ isUpdated ? $strings.ButtonSave : $strings.MessageNoUpdatesWereNecessary }}</ui-btn>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    processing: Boolean,
    libraryItem: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      enableAutoDownloadEpisodes: false,
      cronExpression: null,
      newMaxEpisodesToKeep: 0,
      newMaxNewEpisodesToDownload: 0,
      newAutoAddToPlaylistIds: [],
      playlists: [],
      loadingPlaylists: false,
      playlistMenuOpen: false
    }
  },
  watch: {
    libraryItem: {
      immediate: true,
      handler(newVal) {
        if (newVal) this.init()
      }
    }
  },
  computed: {
    isProcessing: {
      get() {
        return this.processing
      },
      set(val) {
        this.$emit('update:processing', val)
      }
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    media() {
      return this.libraryItem ? this.libraryItem.media || {} : {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    libraryItemId() {
      return this.libraryItem ? this.libraryItem.id : null
    },
    libraryId() {
      return this.libraryItem ? this.libraryItem.libraryId : null
    },
    feedUrl() {
      return this.mediaMetadata.feedUrl
    },
    autoDownloadEpisodes() {
      return !!this.media.autoDownloadEpisodes
    },
    autoDownloadSchedule() {
      return this.media.autoDownloadSchedule
    },
    maxEpisodesToKeep() {
      return this.media.maxEpisodesToKeep
    },
    maxNewEpisodesToDownload() {
      return this.media.maxNewEpisodesToDownload
    },
    autoAddToPlaylistIds() {
      return this.media.autoAddToPlaylistIds || []
    },
    isUpdated() {
      return (
        this.autoDownloadSchedule !== this.cronExpression ||
        this.autoDownloadEpisodes !== this.enableAutoDownloadEpisodes ||
        this.maxEpisodesToKeep !== Number(this.newMaxEpisodesToKeep) ||
        this.maxNewEpisodesToDownload !== Number(this.newMaxNewEpisodesToDownload) ||
        JSON.stringify(this.autoAddToPlaylistIds.slice().sort()) !== JSON.stringify(this.newAutoAddToPlaylistIds.slice().sort())
      )
    },
    selectedPlaylistLabel() {
      if (this.loadingPlaylists) return '...'
      if (!this.newAutoAddToPlaylistIds.length) return this.$strings.LabelNone
      if (this.newAutoAddToPlaylistIds.length === 1) {
        const playlist = this.playlists.find((p) => p.id === this.newAutoAddToPlaylistIds[0])
        return playlist ? playlist.name : this.$strings.LabelNone
      }
      return this.$getString('LabelCountPlaylists', [this.newAutoAddToPlaylistIds.length])
    }
  },
  methods: {
    closePlaylistMenu() {
      this.playlistMenuOpen = false
    },
    togglePlaylist(id) {
      if (this.newAutoAddToPlaylistIds.includes(id)) {
        this.newAutoAddToPlaylistIds = this.newAutoAddToPlaylistIds.filter((pid) => pid !== id)
      } else {
        this.newAutoAddToPlaylistIds = [...this.newAutoAddToPlaylistIds, id]
      }
    },
    updatedMaxEpisodesToKeep() {
      if (isNaN(this.newMaxEpisodesToKeep) || this.newMaxEpisodesToKeep < 0) {
        this.newMaxEpisodesToKeep = 0
      } else {
        this.newMaxEpisodesToKeep = Number(this.newMaxEpisodesToKeep)
      }
    },
    updateMaxNewEpisodesToDownload() {
      if (isNaN(this.newMaxNewEpisodesToDownload) || this.newMaxNewEpisodesToDownload < 0) {
        this.newMaxNewEpisodesToDownload = 0
      } else {
        this.newMaxNewEpisodesToDownload = Number(this.newMaxNewEpisodesToDownload)
      }
    },
    save() {
      // If custom expression input is focused then unfocus it instead of submitting
      if (this.$refs.cronExpressionBuilder && this.$refs.cronExpressionBuilder.checkBlurExpressionInput) {
        if (this.$refs.cronExpressionBuilder.checkBlurExpressionInput()) {
          return
        }
      }

      if (this.$refs.maxEpisodesInput?.isFocused) {
        this.$refs.maxEpisodesInput.blur()
      }
      if (this.$refs.maxEpisodesToDownloadInput?.isFocused) {
        this.$refs.maxEpisodesToDownloadInput.blur()
      }

      const updatePayload = {
        autoDownloadEpisodes: this.enableAutoDownloadEpisodes,
        autoAddToPlaylistIds: this.newAutoAddToPlaylistIds
      }
      if (this.enableAutoDownloadEpisodes) {
        updatePayload.autoDownloadSchedule = this.cronExpression
      }
      this.newMaxEpisodesToKeep = Number(this.newMaxEpisodesToKeep)
      if (this.newMaxEpisodesToKeep !== this.maxEpisodesToKeep) {
        updatePayload.maxEpisodesToKeep = this.newMaxEpisodesToKeep
      }
      this.newMaxNewEpisodesToDownload = Number(this.newMaxNewEpisodesToDownload)
      if (this.newMaxNewEpisodesToDownload !== this.maxNewEpisodesToDownload) {
        updatePayload.maxNewEpisodesToDownload = this.newMaxNewEpisodesToDownload
      }

      this.updateDetails(updatePayload)
    },
    async updateDetails(updatePayload) {
      this.isProcessing = true
      var updateResult = await this.$axios.$patch(`/api/items/${this.libraryItemId}/media`, updatePayload).catch((error) => {
        console.error('Failed to update', error)
        const errorMessage = typeof error?.response?.data === 'string' ? error?.response?.data : null
        this.$toast.error(errorMessage || this.$strings.ToastFailedToUpdate)
        return false
      })
      this.isProcessing = false
      if (updateResult) {
        if (updateResult.updated) {
          this.$toast.success(this.$strings.ToastItemDetailsUpdateSuccess)
          return true
        } else {
          this.$toast.info(this.$strings.MessageNoUpdatesWereNecessary)
        }
      }
      return false
    },
    async loadPlaylists() {
      if (!this.libraryId) return
      this.loadingPlaylists = true
      try {
        const data = await this.$axios.$get(`/api/libraries/${this.libraryId}/playlists?namesOnly=1`)
        this.playlists = data.results || []
      } catch (error) {
        console.error('Failed to load playlists', error)
      } finally {
        this.loadingPlaylists = false
      }
    },
    init() {
      this.enableAutoDownloadEpisodes = this.autoDownloadEpisodes
      this.cronExpression = this.autoDownloadSchedule
      this.newMaxEpisodesToKeep = this.maxEpisodesToKeep
      this.newMaxNewEpisodesToDownload = this.maxNewEpisodesToDownload
      this.newAutoAddToPlaylistIds = [...this.autoAddToPlaylistIds]
      this.loadPlaylists()
    }
  },
  mounted() {
    this.init()
  }
}
</script>

<style scoped>
#scheduleWrapper {
  height: calc(100% - 80px);
  max-height: calc(100% - 80px);
}
</style>
