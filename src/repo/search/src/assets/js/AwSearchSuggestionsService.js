// Copyright (c) 2021 Siemens 
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions*/
import _ from 'lodash';
import awSearchControllerService from 'js/awSearchControllerService';
import searchSnippetsService from 'js/searchSnippetsService';
import AwLink from 'viewmodel/AwLinkViewModel';


/**
 * render function for AwSuggestions
 * @param {*} props props
 * @returns {JSX.Element} react component
 */
export const awSearchSuggestionsServiceRenderFunction = ( props ) => {
    const {  searchstring, action, closeAction, actions, fields, viewModel, i18n } = props;
    const { data } = viewModel;
    const { suggestions, recents, getRecentsDone, getSuggestionsDone, displayClearAll } = data;
    let hasSuggestions = suggestions && suggestions.length > 0;
    let headerSuggestions = hasSuggestions ? i18n.suggestions : i18n.noSuggestions;
    let headerRecents = displayClearAll === true ? i18n.recentSearches : displayClearAll === false ? i18n.clearedRecentSearches : '';
    let hasRecents = recents && recents.length > 0;
    const showMoreFlag = awSearchControllerService.getMoreFlag();
    const keyPressed = function( event, item ) {
        if( event.key === 'Enter' ) {
            selectSuggestionAndExecuteSearch( event, item );
        }
    };
    const selectSuggestionAndExecuteSearch = function( event, item ) {
        event.preventDefault();
        item = searchSnippetsService.unEscapeHtml( item );
        let evt = {
            target: {
                value: item
            }
        };
        searchstring.onChange( evt );
        action();
        closeAction();
    };

    const renderPopupItems = function( header, PopupItems, classNamePopup, isRecent ) {
        return (
            <div className={classNamePopup}>
                <div className='aw-layout-flexRowContainer aw-search-recentSearchBoxHeader'>
                    <div className ='aw-search-recentSearchBoxTitle aw-search-popupTitle'>{header}</div>
                    { isRecent &&
                        <div className='aw-search-recentSearchBoxCommand'>
                            { displayClearAll &&
                                <AwLink {...fields.clearAll} action={actions.deleteAllRecentSearches}></AwLink>
                            }
                            { displayClearAll === false &&
                                <AwLink {...fields.undoClearAll} action={actions.undoDeleteAllRecentSearches}></AwLink>
                            }
                        </div>
                    }
                </div>
                <div className= 'aw-base-scrollPanel'  >
                    <ul className='aw-widgets-cellListWidget'>
                        {
                            PopupItems && PopupItems.length > 0 && PopupItems.map( ( item )=> {
                                let itemWithHighlights = searchSnippetsService.highlightSearchResults( item, searchstring.value, { cssStyle: { fontWeight: 'bold' } } );
                                return (
                                    // FIXME non interactive element with mouse / keyboard listener
                                    <li className='aw-widgets-cellListItem aw-widgets-cellTop' key={item}
                                        onClick={( event ) => selectSuggestionAndExecuteSearch( event, item )}
                                        onKeyDown={( event ) => keyPressed( event, item )}
                                        title={item}>
                                        {itemWithHighlights}
                                    </li>
                                );
                            } )
                        }
                    </ul>
                </div>
                { isRecent && PopupItems && PopupItems.length >= 5 &&
                    <div className='aw-layout-flexRowContainer aw-search-recentSearchBoxFooter'>
                        <div className='aw-search-recentSearchBoxCommand'>
                            { showMoreFlag && <AwLink {...fields.showMore} action={actions.toggleShowMoreFlag}></AwLink>}
                            { !showMoreFlag && <AwLink {...fields.showLess} action={actions.toggleShowMoreFlag}></AwLink>}
                        </div>
                    </div>
                }
            </div>
        );
    };
    if ( getRecentsDone && getSuggestionsDone && ( !hasSuggestions && !hasRecents ) ) {
        closeAction();
    } else{
        return (
            <>
                {hasSuggestions && renderPopupItems( headerSuggestions, suggestions, 'aw-search-suggestionsPopup', false )}
                { hasSuggestions && hasRecents && <div className='aw-search-searchSuggestionsBreak aw-search-refineLabel'></div>}
                {( hasRecents || !displayClearAll ) && renderPopupItems( headerRecents, recents, 'aw-search-recentSearchPopup', true )}
            </>
        );
    }
};
