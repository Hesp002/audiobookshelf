<template>
  <div class="w-full bg-primary/40">
    <div class="w-full h-14 flex items-center px-4 md:px-6 py-2 bg-primary">
      <template v-if="isSelectionMode">
        <p class="pr-4 text-sm">{{ $getString('MessageSelected', [selectedItems.length]) }}</p>
        <div class="grow" />
        <ui-btn color="bg-error" small class="mr-2" @click="removeSelectedItems">{{ $strings.ButtonRemove }}</ui-btn>
        <ui-btn color="bg-white/10" small @click="clearSelection">{{ $strings.ButtonCancel }}</ui-btn>
      </template>
      <template v-else>
        <p class="pr-4">{{ $strings.HeaderPlaylistItems }}</p>

        <div class="w-6 h-6 md:w-7 md:h-7 bg-white/10 rounded-full flex items-center justify-center">
          <span class="text-xs md:text-sm font-mono leading-none">{{ items.length }}</span>
        </div>
        <div class="grow" />

        <div v-if="items.length > 1" class="flex items-center gap-3">
          <ui-checkbox v-if="isPodcastPlaylist" v-model="alternatingPodcast" :label="$strings.LabelPlaylistSortAlternating" small checkbox-bg="primary" border-color="gray-500" :disabled="selectedSort === 'default'" />

          <div class="relative" v-click-outside="closeSortMenu">
            <button @click="sortMenuOpen = !sortMenuOpen" class="flex items-center gap-1 text-xs px-2 py-1 border border-gray-600 rounded hover:border-gray-400 text-gray-300 hover:text-white transition-colors">
              <span class="material-symbols text-sm">sort</span>
              <span class="hidden sm:inline">{{ selectedSortLabel }}</span>
              <span class="material-symbols text-sm">{{ sortMenuOpen ? 'expand_less' : 'expand_more' }}</span>
            </button>
            <ul v-show="sortMenuOpen" class="absolute z-20 right-0 mt-1 bg-bg border border-gray-600 rounded shadow-lg text-sm min-w-48 py-1">
              <li
                v-for="opt in sortOptions"
                :key="opt.value"
                @click="selectSort(opt.value)"
                class="px-3 py-1.5 cursor-pointer hover:bg-white/5 flex items-center gap-2"
                :class="selectedSort === opt.value ? 'text-yellow-400' : 'text-gray-200'"
              >
                <span class="material-symbols text-sm" :class="selectedSort === opt.value ? 'opacity-100' : 'opacity-0'">check</span>
                {{ opt.label }}
              </li>
            </ul>
          </div>
        </div>

        <ui-btn v-if="hasPendingChanges || saving" color="bg-success" small class="ml-3" :disabled="saving" @click="saveOrder">
          <span v-if="saving" class="material-symbols animate-spin text-base leading-none">sync</span>
          <span v-else>{{ $strings.ButtonSaveOrder }}</span>
        </ui-btn>
        <ui-btn v-if="finishedItems.length || removingFinished" color="bg-white/10" small class="ml-3" :disabled="removingFinished" @click="removeFinishedItems">
          <span v-if="removingFinished" class="material-symbols animate-spin text-base leading-none">sync</span>
          <span v-else>{{ $strings.ButtonRemoveFinished }}</span>
        </ui-btn>
        <p v-if="totalDuration" class="text-sm text-gray-200 ml-3">{{ totalDurationPretty }}</p>
      </template>
    </div>
    <draggable v-model="itemsCopy" v-bind="dragOptions" class="list-group" handle=".drag-handle" draggable=".item" tag="div" :disabled="isSelectionMode" @start="drag = true" @end="drag = false" @update="draggableUpdate">
      <transition-group type="transition" :name="!drag ? 'playlist-item' : null">
        <template v-for="item in itemsCopy">
          <tables-playlist-item-table-row
            :key="itemKey(item)"
            :is-dragging="drag"
            :item="item"
            :playlist-id="playlistId"
            :book-cover-aspect-ratio="bookCoverAspectRatio"
            :is-selection-mode="isSelectionMode"
            :is-selected="isItemSelected(item)"
            class="item"
            :class="drag ? '' : 'playlist-item-item'"
            @edit="editItem"
            @select="handleSelectItem"
          />
        </template>
      </transition-group>
    </draggable>
  </div>
</template>

<script>
import draggable from 'vuedraggable'

export default {
  components: {
    draggable
  },
  props: {
    playlistId: String,
    items: {
      type: Array,
      default: () => []
    },
    selectionModeActive: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      drag: false,
      dragOptions: {
        animation: 200,
        group: 'description',
        ghostClass: 'ghost'
      },
      itemsCopy: [],
      selectedSort: 'default',
      alternatingPodcast: false,
      sortMenuOpen: false,
      selectedItems: [],
      hasPendingChanges: false,
      saving: false,
      removingFinished: false
    }
  },
  watch: {
    items: {
      handler(newVal) {
        this.selectedItems = []
        this.init()
      }
    },
    alternatingPodcast() {
      if (this.selectedSort !== 'default') this.applySort()
    },
    selectionModeActive(val) {
      if (!val) this.selectedItems = []
    }
  },
  computed: {
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    totalDuration() {
      var _total = 0
      this.items.forEach((item) => {
        if (item.episode) _total += item.episode.duration
        else _total += item.libraryItem.media.duration
      })
      return _total
    },
    totalDurationPretty() {
      return this.$elapsedPrettyExtended(this.totalDuration)
    },
    isPodcastPlaylist() {
      return this.items.some((i) => i.episode)
    },
    sortOptions() {
      const options = [{ value: 'default', label: this.$strings.LabelPlaylistSortManual }]

      if (this.isPodcastPlaylist) {
        options.push(
          { value: 'ep-date-desc', label: this.$strings.LabelPlaylistSortEpDateDesc },
          { value: 'ep-date-asc', label: this.$strings.LabelPlaylistSortEpDateAsc },
          { value: 'ep-title-asc', label: this.$strings.LabelPlaylistSortTitleAZ },
          { value: 'ep-title-desc', label: this.$strings.LabelPlaylistSortTitleZA },
          { value: 'podcast-asc', label: this.$strings.LabelPlaylistSortPodcastAZ },
          { value: 'duration-asc', label: this.$strings.LabelPlaylistSortDurationShortest },
          { value: 'duration-desc', label: this.$strings.LabelPlaylistSortDurationLongest }
        )
      } else {
        options.push(
          { value: 'title-asc', label: this.$strings.LabelPlaylistSortTitleAZ },
          { value: 'title-desc', label: this.$strings.LabelPlaylistSortTitleZA },
          { value: 'author-asc', label: this.$strings.LabelPlaylistSortAuthorAZ },
          { value: 'duration-asc', label: this.$strings.LabelPlaylistSortDurationShortest },
          { value: 'duration-desc', label: this.$strings.LabelPlaylistSortDurationLongest }
        )
      }

      return options
    },
    selectedSortLabel() {
      const opt = this.sortOptions.find((o) => o.value === this.selectedSort)
      return opt ? opt.label : this.$strings.LabelPlaylistSortManual
    },
    isSelectionMode() {
      return this.selectionModeActive
    },
    finishedItems() {
      return this.items.filter((item) => {
        const progress = this.$store.getters['user/getUserMediaProgress'](item.libraryItemId, item.episodeId || null)
        return progress?.isFinished
      })
    }
  },
  methods: {
    itemKey(item) {
      return `${item.libraryItemId}-${item.episodeId || ''}`
    },
    isItemSelected(item) {
      return this.selectedItems.some((s) => this.itemKey(s) === this.itemKey(item))
    },
    handleSelectItem({ item, isSelected }) {
      if (isSelected) {
        if (!this.isItemSelected(item)) this.selectedItems.push(item)
      } else {
        this.selectedItems = this.selectedItems.filter((s) => this.itemKey(s) !== this.itemKey(item))
        if (!this.selectedItems.length) {
          this.$emit('update:selectionModeActive', false)
        }
      }
    },
    clearSelection() {
      this.selectedItems = []
      this.$emit('update:selectionModeActive', false)
    },
    async removeFinishedItems() {
      const items = this.finishedItems.map((i) => ({ libraryItemId: i.libraryItemId, episodeId: i.episodeId }))
      if (!items.length) return
      this.removingFinished = true
      try {
        await this.$axios.$post(`/api/playlists/${this.playlistId}/batch/remove`, { items })
      } catch (error) {
        console.error('Failed to remove finished items from playlist', error)
        const msg = typeof error?.response?.data === 'string' ? error.response.data : null
        this.$toast.error(msg || this.$strings.ToastFailedToUpdate)
      } finally {
        this.removingFinished = false
      }
    },
    async removeSelectedItems() {
      const items = this.selectedItems.map((i) => ({ libraryItemId: i.libraryItemId, episodeId: i.episodeId }))
      try {
        await this.$axios.$post(`/api/playlists/${this.playlistId}/batch/remove`, { items })
        this.selectedItems = []
      } catch (error) {
        console.error('Failed to remove items from playlist', error)
        const msg = typeof error?.response?.data === 'string' ? error.response.data : null
        this.$toast.error(msg || this.$strings.ToastFailedToUpdate)
      }
    },
    editItem(playlistItem) {
      if (playlistItem.episode) {
        const episodeIds = this.items.map((pi) => pi.episodeId)
        this.$store.commit('setEpisodeTableEpisodeIds', episodeIds)
        this.$store.commit('setSelectedLibraryItem', playlistItem.libraryItem)
        this.$store.commit('globals/setSelectedEpisode', playlistItem.episode)
        this.$store.commit('globals/setShowEditPodcastEpisodeModal', true)
      } else {
        const itemIds = this.items.map((i) => i.libraryItemId)
        this.$store.commit('setBookshelfBookIds', itemIds)
        this.$store.commit('showEditModal', playlistItem.libraryItem)
      }
    },
    closeSortMenu() {
      this.sortMenuOpen = false
    },
    selectSort(sort) {
      this.sortMenuOpen = false
      if (sort === this.selectedSort) return
      this.selectedSort = sort
      this.alternatingPodcast = false
      if (sort === 'default') {
        // Keep the current display order so the user can drag from where they are
        this.hasPendingChanges = true
        return
      }
      this.applySort()
    },
    applySort() {
      const items = this.items.map((i) => ({ ...i }))
      const sorted = this.applySortToItems(items, this.selectedSort)
      this.itemsCopy = this.alternatingPodcast && this.isPodcastPlaylist ? this.alternatingSort(sorted) : sorted
      this.hasPendingChanges = true
    },
    applySortToItems(items, sort) {
      if (sort === 'default') return items

      const sorted = [...items]
      switch (sort) {
        case 'ep-date-asc':
          return sorted.sort((a, b) => (a.episode?.publishedAt || 0) - (b.episode?.publishedAt || 0))
        case 'ep-date-desc':
          return sorted.sort((a, b) => (b.episode?.publishedAt || 0) - (a.episode?.publishedAt || 0))
        case 'ep-title-asc':
        case 'title-asc':
          return sorted.sort((a, b) => {
            const ta = (a.episode?.title || a.libraryItem?.media?.metadata?.title || '').toLowerCase()
            const tb = (b.episode?.title || b.libraryItem?.media?.metadata?.title || '').toLowerCase()
            return ta.localeCompare(tb)
          })
        case 'ep-title-desc':
        case 'title-desc':
          return sorted.sort((a, b) => {
            const ta = (a.episode?.title || a.libraryItem?.media?.metadata?.title || '').toLowerCase()
            const tb = (b.episode?.title || b.libraryItem?.media?.metadata?.title || '').toLowerCase()
            return tb.localeCompare(ta)
          })
        case 'podcast-asc':
          return sorted.sort((a, b) => {
            const pa = (a.libraryItem?.media?.metadata?.title || '').toLowerCase()
            const pb = (b.libraryItem?.media?.metadata?.title || '').toLowerCase()
            return pa.localeCompare(pb)
          })
        case 'author-asc':
          return sorted.sort((a, b) => {
            const aa = (a.libraryItem?.media?.metadata?.authors?.[0]?.name || '').toLowerCase()
            const ab = (b.libraryItem?.media?.metadata?.authors?.[0]?.name || '').toLowerCase()
            return aa.localeCompare(ab)
          })
        case 'duration-asc':
          return sorted.sort((a, b) => {
            const da = a.episode ? a.episode.duration : a.libraryItem?.media?.duration || 0
            const db = b.episode ? b.episode.duration : b.libraryItem?.media?.duration || 0
            return da - db
          })
        case 'duration-desc':
          return sorted.sort((a, b) => {
            const da = a.episode ? a.episode.duration : a.libraryItem?.media?.duration || 0
            const db = b.episode ? b.episode.duration : b.libraryItem?.media?.duration || 0
            return db - da
          })
        default:
          return items
      }
    },
    alternatingSort(items) {
      // Group episodes by podcast, preserving the primary sort order within each group.
      // Then interleave round-by-round: all podcasts' 1st episode, then all 2nd, etc.
      const podcastOrder = []
      const groups = {}
      for (const item of items) {
        const id = item.libraryItem.id
        if (!groups[id]) {
          groups[id] = []
          podcastOrder.push(id)
        }
        groups[id].push(item)
      }

      const result = []
      const maxLen = Math.max(...podcastOrder.map((id) => groups[id].length))
      for (let i = 0; i < maxLen; i++) {
        for (const id of podcastOrder) {
          if (i < groups[id].length) result.push(groups[id][i])
        }
      }
      return result
    },
    draggableUpdate() {
      this.selectedSort = 'default'
      this.alternatingPodcast = false
      this.hasPendingChanges = true
    },
    async saveOrder() {
      this.saving = true
      const playlistUpdate = {
        items: this.itemsCopy.map((i) => ({ libraryItemId: i.libraryItemId, episodeId: i.episodeId }))
      }
      try {
        await this.$axios.$patch(`/api/playlists/${this.playlistId}`, playlistUpdate)
        this.hasPendingChanges = false
        this.$toast.success(this.$strings.ToastPlaylistUpdateSuccess)
      } catch (error) {
        console.error('Failed to update playlist order', error)
        const msg = typeof error?.response?.data === 'string' ? error.response.data : null
        this.$toast.error(msg || this.$strings.ToastFailedToUpdate)
      } finally {
        this.saving = false
      }
    },
    init() {
      this.itemsCopy = this.items.map((i) => ({ ...i }))
      this.hasPendingChanges = false
    }
  },
  mounted() {
    this.init()
  }
}
</script>

<style>
.playlist-item-item {
  transition: all 0.4s ease;
}

.playlist-item-enter-from,
.playlist-item-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.playlist-item-leave-active {
  position: absolute;
}
</style>
