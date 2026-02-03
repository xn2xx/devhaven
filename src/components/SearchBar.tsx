import { forwardRef, useState } from "react";

import { IconSearch, IconXCircle } from "./Icons";

export type SearchBarProps = {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
};

const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({ value, placeholder = "搜索项目...", onChange }, ref) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <div
        className={`flex flex-1 items-center gap-2 rounded-md border p-2 transition-colors duration-150 ${
          isFocused ? "bg-search-active-bg border-search-active-border" : "bg-search-bg border-search-border"
        }`}
      >
        <IconSearch
          className={isFocused ? "text-search-active-icon" : "text-search-placeholder"}
          size={16}
        />
        <input
          ref={ref}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="flex-1 border-none bg-transparent text-search-text text-fs-search outline-none placeholder:text-search-placeholder caret-search-caret"
        />
        {value ? (
          <button
            type="button"
            className="icon-btn text-titlebar-icon"
            aria-label="清除搜索"
            onClick={() => onChange("")}
          >
            <IconXCircle size={16} />
          </button>
        ) : null}
      </div>
    );
  },
);

SearchBar.displayName = "SearchBar";

export default SearchBar;
