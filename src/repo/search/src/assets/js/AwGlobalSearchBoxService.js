import AwSearchBox from 'viewmodel/AwSearchBoxViewModel';
import AwLink from 'viewmodel/AwLinkViewModel';
import AwWidget from 'viewmodel/AwWidgetViewModel';
import AwPopup from 'viewmodel/AwPopupViewModel';
import AwRevisionRule from 'viewmodel/AwRevisionRuleViewModel';
import AwSearchSuggestions from 'viewmodel/AwSearchSuggestionsViewModel';
import eventBus from 'js/eventBus';
import awSearchControllerService from 'js/awSearchControllerService';
import awSearchCoreService from 'js/awSearchCoreService';

export const expandCollapseSearchBox = ( expand, searchString ) => {
    if ( !searchString || searchString.trim().length < 1 ) {
        const newExpand = { ...expand };
        newExpand.value = false;
        expand.update( newExpand );
    }
};

export const addRemoveClickListener = ( expand ) => {
    if ( expand.value === 'true' ) {
        document.body.addEventListener( 'click', awSearchCoreService.bodyClickListener, true );
    } else{
        document.body.removeEventListener( 'click', awSearchCoreService.bodyClickListener, true );
    }
};

/**
 * render function for awGlobalSearchBox
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const awGlobalSearchBoxServiceRenderFunction = ( props ) => {
    const {  fields, viewModel, actions, show, expand } = props;
    let { hintPopup } = actions;
    const { ctx, conditions } = viewModel;

    const closePopup = () => {
        hintPopup.hide();
    };
    const onKeyPress = ( event ) => {
        if( event.key === 'Enter' ) {
            event.preventDefault();
            actions.doGlobalSearch();
            closePopup();
        } else {
            setTimeout( () => {
                eventBus.publish( 'search.criteriaChanged' );
            }, 300 );
            if( !hintPopup.open ) {
                hintPopup.show( {
                    width: hintPopup.reference.current.offsetWidth
                } );
            }
        }
    };
    const onClickMe = () => {
        let recents = awSearchControllerService.retrieveRecentSearchObjectsFiltered( ctx.user.uid, fields.searchBox.value );
        let hasRecents = recents && recents.length > 0;
        if(  hasRecents  && !hintPopup.open ) {
            hintPopup.show( {
                width: hintPopup.reference.current.offsetWidth
            } );
        }
    };
    if ( expand.value !== 'true' && !( show && show.value ) ) {
        return '';
    }
    const dropdownToDisplay = ( value ) => {
        let dropdownLOV;
        if( value ) {
            dropdownLOV = <div className='aw-search-searchPreFilterPanel2'>
                <AwWidget action={actions.updatePrefilter2} {...fields.selectPrefilter2} dirty={conditions.isPrefilter2Dirty ? '' : 'true'}></AwWidget>
            </div>;
        } else {
            dropdownLOV =  <div className='aw-search-searchPreFilterPanel3'>
                <AwWidget {...fields.selectPrefilter3} dirty={conditions.isPrefilter3Dirty ? '' : 'true'}></AwWidget>
            </div>;
        }
        return dropdownLOV;
    };

    let showDefaultFilter = true;

    let isCrossDomainSearchInstalled = ctx.preferences.XST_cross_domain_sources;
    if( isCrossDomainSearchInstalled && isCrossDomainSearchInstalled.length > 0 ) {
        showDefaultFilter = false;
    }
    const activeFilter = dropdownToDisplay( showDefaultFilter );

    return (
        <div className='aw-search-searchContainer aw-search-globalSearchContainer'>
            <div className='aw-search-globalSearchElementsContainer'>
                <div className='aw-search-globalSearchPreFilterWrapper'>
                    <div className='aw-search-searchPreFilterPanel1'>
                        <AwWidget action={actions.updatePrefilter1} {...fields.selectPrefilter1} dirty={conditions.isPrefilter1Dirty ? '' : 'true'}></AwWidget>
                    </div>
                    {activeFilter}
                </div>
                <div className='aw-search-globalSearchWrapper'>
                    <AwSearchBox
                        domRef={hintPopup.reference}
                        closeAction={closePopup}
                        action={actions.doGlobalSearch}
                        onKeyDown={( event )=> onKeyPress( event )}
                        onClick={()=> onClickMe()}
                        prop = {fields.searchBox}>
                    </AwSearchBox>
                    <AwPopup {...hintPopup.options}>
                        <AwSearchSuggestions searchstring={fields.searchBox} closeAction={closePopup} action={actions.doGlobalSearch} {...fields}></AwSearchSuggestions>
                    </AwPopup>

                </div>
            </div>
            <div className='aw-search-globalSearchLinksContainer'>
                <div className='aw-search-globalSearchLinksPadding'></div>
                <div className='aw-search-globalSearchLinksContainer2'>
                    <div className='aw-search-globalSearchLinksPanel2'>
                        <AwRevisionRule></AwRevisionRule>
                    </div>
                    {
                        conditions.showAdvancedSearchLink &&
                        <div className='aw-search-globalSearchLinksPanel1'>
                            <AwLink {...fields.advancedSearch} action={actions.advancedSearchLink}></AwLink>
                        </div>
                    }
                </div>
            </div>
        </div>
    );
};
