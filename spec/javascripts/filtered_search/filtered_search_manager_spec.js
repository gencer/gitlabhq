import * as urlUtils from '~/lib/utils/url_utility';
import * as recentSearchesStoreSrc from '~/filtered_search/stores/recent_searches_store';
import RecentSearchesService from '~/filtered_search/services/recent_searches_service';
import RecentSearchesServiceError from '~/filtered_search/services/recent_searches_service_error';
import RecentSearchesRoot from '~/filtered_search/recent_searches_root';
import '~/lib/utils/common_utils';
import '~/filtered_search/filtered_search_token_keys';
import '~/filtered_search/filtered_search_tokenizer';
import '~/filtered_search/filtered_search_dropdown_manager';
import '~/filtered_search/filtered_search_manager';
import FilteredSearchSpecHelper from '../helpers/filtered_search_spec_helper';

describe('Filtered Search Manager', () => {
  let input;
  let manager;
  let tokensContainer;
  const placeholder = 'Search or filter results...';

  function dispatchBackspaceEvent(element, eventType) {
    const backspaceKey = 8;
    const event = new Event(eventType);
    event.keyCode = backspaceKey;
    element.dispatchEvent(event);
  }

  function dispatchDeleteEvent(element, eventType) {
    const deleteKey = 46;
    const event = new Event(eventType);
    event.keyCode = deleteKey;
    element.dispatchEvent(event);
  }

  function getVisualTokens() {
    return tokensContainer.querySelectorAll('.js-visual-token');
  }

  beforeEach(() => {
    setFixtures(`
      <div class="filtered-search-box">
        <form>
          <ul class="tokens-container list-unstyled">
            ${FilteredSearchSpecHelper.createInputHTML(placeholder)}
          </ul>
          <button class="clear-search" type="button">
            <i class="fa fa-times"></i>
          </button>
        </form>
      </div>
    `);

    spyOn(gl.FilteredSearchDropdownManager.prototype, 'setDropdown').and.callFake(() => {});
  });

  const initializeManager = () => {
    /* eslint-disable jasmine/no-unsafe-spy */
    spyOn(gl.FilteredSearchManager.prototype, 'loadSearchParamsFromURL').and.callFake(() => {});
    spyOn(gl.FilteredSearchManager.prototype, 'tokenChange').and.callFake(() => {});
    spyOn(gl.FilteredSearchDropdownManager.prototype, 'updateDropdownOffset').and.callFake(() => {});
    spyOn(gl.utils, 'getParameterByName').and.returnValue(null);
    spyOn(gl.FilteredSearchVisualTokens, 'unselectTokens').and.callThrough();
    /* eslint-enable jasmine/no-unsafe-spy */

    input = document.querySelector('.filtered-search');
    tokensContainer = document.querySelector('.tokens-container');
    manager = new gl.FilteredSearchManager();
    manager.setup();
  };

  afterEach(() => {
    manager.cleanup();
  });

  describe('class constructor', () => {
    const isLocalStorageAvailable = 'isLocalStorageAvailable';

    beforeEach(() => {
      spyOn(RecentSearchesService, 'isAvailable').and.returnValue(isLocalStorageAvailable);
      spyOn(recentSearchesStoreSrc, 'default');
      spyOn(RecentSearchesRoot.prototype, 'render');
    });

    it('should instantiate RecentSearchesStore with isLocalStorageAvailable', () => {
      manager = new gl.FilteredSearchManager();

      expect(RecentSearchesService.isAvailable).toHaveBeenCalled();
      expect(recentSearchesStoreSrc.default).toHaveBeenCalledWith({
        isLocalStorageAvailable,
        allowedKeys: gl.FilteredSearchTokenKeys.getKeys(),
      });
    });
  });

  describe('setup', () => {
    beforeEach(() => {
      manager = new gl.FilteredSearchManager();
    });

    it('should not instantiate Flash if an RecentSearchesServiceError is caught', () => {
      spyOn(RecentSearchesService.prototype, 'fetch').and.callFake(() => Promise.reject(new RecentSearchesServiceError()));
      spyOn(window, 'Flash');

      manager.setup();

      expect(window.Flash).not.toHaveBeenCalled();
    });
  });

  describe('searchState', () => {
    beforeEach(() => {
      spyOn(gl.FilteredSearchManager.prototype, 'search').and.callFake(() => {});
      initializeManager();
    });

    it('should blur button', () => {
      const e = {
        preventDefault: () => {},
        currentTarget: {
          blur: () => {},
        },
      };
      spyOn(e.currentTarget, 'blur').and.callThrough();
      manager.searchState(e);

      expect(e.currentTarget.blur).toHaveBeenCalled();
    });

    it('should not call search if there is no state', () => {
      const e = {
        preventDefault: () => {},
        currentTarget: {
          blur: () => {},
        },
      };

      manager.searchState(e);
      expect(gl.FilteredSearchManager.prototype.search).not.toHaveBeenCalled();
    });

    it('should call search when there is state', () => {
      const e = {
        preventDefault: () => {},
        currentTarget: {
          blur: () => {},
          dataset: {
            state: 'opened',
          },
        },
      };

      manager.searchState(e);
      expect(gl.FilteredSearchManager.prototype.search).toHaveBeenCalledWith('opened');
    });
  });

  describe('search', () => {
    const defaultParams = '?scope=all&utf8=%E2%9C%93&state=opened';

    beforeEach(() => {
      initializeManager();
    });

    it('should search with a single word', (done) => {
      input.value = 'searchTerm';

      spyOn(urlUtils, 'visitUrl').and.callFake((url) => {
        expect(url).toEqual(`${defaultParams}&search=searchTerm`);
        done();
      });

      manager.search();
    });

    it('should search with multiple words', (done) => {
      input.value = 'awesome search terms';

      spyOn(urlUtils, 'visitUrl').and.callFake((url) => {
        expect(url).toEqual(`${defaultParams}&search=awesome+search+terms`);
        done();
      });

      manager.search();
    });

    it('should search with special characters', (done) => {
      input.value = '~!@#$%^&*()_+{}:<>,.?/';

      spyOn(urlUtils, 'visitUrl').and.callFake((url) => {
        expect(url).toEqual(`${defaultParams}&search=~!%40%23%24%25%5E%26*()_%2B%7B%7D%3A%3C%3E%2C.%3F%2F`);
        done();
      });

      manager.search();
    });

    it('removes duplicated tokens', (done) => {
      tokensContainer.innerHTML = FilteredSearchSpecHelper.createTokensContainerHTML(`
        ${FilteredSearchSpecHelper.createFilterVisualTokenHTML('label', '~bug')}
        ${FilteredSearchSpecHelper.createFilterVisualTokenHTML('label', '~bug')}
      `);

      spyOn(urlUtils, 'visitUrl').and.callFake((url) => {
        expect(url).toEqual(`${defaultParams}&label_name[]=bug`);
        done();
      });

      manager.search();
    });
  });

  describe('handleInputPlaceholder', () => {
    beforeEach(() => {
      initializeManager();
    });

    it('should render placeholder when there is no input', () => {
      expect(input.placeholder).toEqual(placeholder);
    });

    it('should not render placeholder when there is input', () => {
      input.value = 'test words';

      const event = new Event('input');
      input.dispatchEvent(event);

      expect(input.placeholder).toEqual('');
    });

    it('should not render placeholder when there are tokens and no input', () => {
      tokensContainer.innerHTML = FilteredSearchSpecHelper.createTokensContainerHTML(
        FilteredSearchSpecHelper.createFilterVisualTokenHTML('label', '~bug'),
      );

      const event = new Event('input');
      input.dispatchEvent(event);

      expect(input.placeholder).toEqual('');
    });
  });

  describe('checkForBackspace', () => {
    beforeEach(() => {
      initializeManager();
    });

    describe('tokens and no input', () => {
      beforeEach(() => {
        tokensContainer.innerHTML = FilteredSearchSpecHelper.createTokensContainerHTML(
          FilteredSearchSpecHelper.createFilterVisualTokenHTML('label', '~bug'),
        );
      });

      it('removes last token', () => {
        spyOn(gl.FilteredSearchVisualTokens, 'removeLastTokenPartial').and.callThrough();
        dispatchBackspaceEvent(input, 'keyup');

        expect(gl.FilteredSearchVisualTokens.removeLastTokenPartial).toHaveBeenCalled();
      });

      it('sets the input', () => {
        spyOn(gl.FilteredSearchVisualTokens, 'getLastTokenPartial').and.callThrough();
        dispatchDeleteEvent(input, 'keyup');

        expect(gl.FilteredSearchVisualTokens.getLastTokenPartial).toHaveBeenCalled();
        expect(input.value).toEqual('~bug');
      });
    });

    it('does not remove token or change input when there is existing input', () => {
      spyOn(gl.FilteredSearchVisualTokens, 'removeLastTokenPartial').and.callThrough();
      spyOn(gl.FilteredSearchVisualTokens, 'getLastTokenPartial').and.callThrough();

      input.value = 'text';
      dispatchDeleteEvent(input, 'keyup');

      expect(gl.FilteredSearchVisualTokens.removeLastTokenPartial).not.toHaveBeenCalled();
      expect(gl.FilteredSearchVisualTokens.getLastTokenPartial).not.toHaveBeenCalled();
      expect(input.value).toEqual('text');
    });
  });

  describe('removeToken', () => {
    beforeEach(() => {
      initializeManager();
    });

    it('removes token even when it is already selected', () => {
      tokensContainer.innerHTML = FilteredSearchSpecHelper.createTokensContainerHTML(
        FilteredSearchSpecHelper.createFilterVisualTokenHTML('milestone', 'none', true),
      );

      tokensContainer.querySelector('.js-visual-token .remove-token').click();
      expect(tokensContainer.querySelector('.js-visual-token')).toEqual(null);
    });

    describe('unselected token', () => {
      beforeEach(() => {
        spyOn(gl.FilteredSearchManager.prototype, 'removeSelectedToken').and.callThrough();

        tokensContainer.innerHTML = FilteredSearchSpecHelper.createTokensContainerHTML(
          FilteredSearchSpecHelper.createFilterVisualTokenHTML('milestone', 'none'),
        );
        tokensContainer.querySelector('.js-visual-token .remove-token').click();
      });

      it('removes token when remove button is selected', () => {
        expect(tokensContainer.querySelector('.js-visual-token')).toEqual(null);
      });

      it('calls removeSelectedToken', () => {
        expect(manager.removeSelectedToken).toHaveBeenCalled();
      });
    });
  });

  describe('removeSelectedTokenKeydown', () => {
    beforeEach(() => {
      initializeManager();
      tokensContainer.innerHTML = FilteredSearchSpecHelper.createTokensContainerHTML(
        FilteredSearchSpecHelper.createFilterVisualTokenHTML('milestone', 'none', true),
      );
    });

    it('removes selected token when the backspace key is pressed', () => {
      expect(getVisualTokens().length).toEqual(1);

      dispatchBackspaceEvent(document, 'keydown');

      expect(getVisualTokens().length).toEqual(0);
    });

    it('removes selected token when the delete key is pressed', () => {
      expect(getVisualTokens().length).toEqual(1);

      dispatchDeleteEvent(document, 'keydown');

      expect(getVisualTokens().length).toEqual(0);
    });

    it('updates the input placeholder after removal', () => {
      manager.handleInputPlaceholder();

      expect(input.placeholder).toEqual('');
      expect(getVisualTokens().length).toEqual(1);

      dispatchBackspaceEvent(document, 'keydown');

      expect(input.placeholder).not.toEqual('');
      expect(getVisualTokens().length).toEqual(0);
    });

    it('updates the clear button after removal', () => {
      manager.toggleClearSearchButton();

      const clearButton = document.querySelector('.clear-search');

      expect(clearButton.classList.contains('hidden')).toEqual(false);
      expect(getVisualTokens().length).toEqual(1);

      dispatchBackspaceEvent(document, 'keydown');

      expect(clearButton.classList.contains('hidden')).toEqual(true);
      expect(getVisualTokens().length).toEqual(0);
    });
  });

  describe('removeSelectedToken', () => {
    beforeEach(() => {
      spyOn(gl.FilteredSearchVisualTokens, 'removeSelectedToken').and.callThrough();
      spyOn(gl.FilteredSearchManager.prototype, 'handleInputPlaceholder').and.callThrough();
      spyOn(gl.FilteredSearchManager.prototype, 'toggleClearSearchButton').and.callThrough();
      initializeManager();
    });

    it('calls FilteredSearchVisualTokens.removeSelectedToken', () => {
      manager.removeSelectedToken();

      expect(gl.FilteredSearchVisualTokens.removeSelectedToken).toHaveBeenCalled();
    });

    it('calls handleInputPlaceholder', () => {
      manager.removeSelectedToken();

      expect(manager.handleInputPlaceholder).toHaveBeenCalled();
    });

    it('calls toggleClearSearchButton', () => {
      manager.removeSelectedToken();

      expect(manager.toggleClearSearchButton).toHaveBeenCalled();
    });

    it('calls update dropdown offset', () => {
      manager.removeSelectedToken();

      expect(manager.dropdownManager.updateDropdownOffset).toHaveBeenCalled();
    });
  });

  describe('Clearing search', () => {
    beforeEach(() => {
      initializeManager();
    });

    it('Clicking the "x" clear button, clears the input', () => {
      const inputValue = 'label:~bug ';
      manager.filteredSearchInput.value = inputValue;
      manager.filteredSearchInput.dispatchEvent(new Event('input'));

      expect(gl.DropdownUtils.getSearchQuery()).toEqual(inputValue);

      manager.clearSearchButton.click();

      expect(manager.filteredSearchInput.value).toEqual('');
      expect(gl.DropdownUtils.getSearchQuery()).toEqual('');
    });
  });

  describe('toggleInputContainerFocus', () => {
    beforeEach(() => {
      initializeManager();
    });

    it('toggles on focus', () => {
      input.focus();
      expect(document.querySelector('.filtered-search-box').classList.contains('focus')).toEqual(true);
    });

    it('toggles on blur', () => {
      input.blur();
      expect(document.querySelector('.filtered-search-box').classList.contains('focus')).toEqual(false);
    });
  });

  describe('getAllParams', () => {
    beforeEach(() => {
      this.paramsArr = ['key=value', 'otherkey=othervalue'];

      initializeManager();
    });

    it('correctly modifies params when custom modifier is passed', () => {
      const modifedParams = manager.getAllParams.call({
        modifyUrlParams: paramsArr => paramsArr.reverse(),
      }, [].concat(this.paramsArr));

      expect(modifedParams[0]).toBe(this.paramsArr[1]);
    });

    it('does not modify params when no custom modifier is passed', () => {
      const modifedParams = manager.getAllParams.call({}, this.paramsArr);

      expect(modifedParams[1]).toBe(this.paramsArr[1]);
    });
  });
});
