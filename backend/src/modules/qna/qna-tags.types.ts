// Internal domain types for the qna-tags module.
export interface TagListFilters {
  search?: string;
}

export interface TagListItem {
  id: string;
  name: string;
  questionCount: number;
}

/** Tag lists are small — no pagination, just a reasonable cap for the autocomplete/browse UI. */
export const TAG_LIST_LIMIT = 50;
