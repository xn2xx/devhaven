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
      <div className={`search-bar${isFocused ? " is-active" : ""}`}>
        <IconSearch className="search-icon" size={16} />
        <input
          ref={ref}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {value ? (
          <button
            type="button"
            className="icon-button search-clear"
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
