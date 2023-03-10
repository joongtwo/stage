// Copyright (c) 2021 Siemens
/* global */

/**
 * @module js/AwDiscoveryRecipeChipsService
 */

import AwChip from 'viewmodel/AwChipViewModel';
import AwButton from 'viewmodel/AwButtonViewModel';
import eventBus from 'js/eventBus';
import AwPopup from 'viewmodel/AwPopupViewModel';
import resizeObserverSvc from 'js/resizeObserver.service';
import AwDiscoveryRecipeChipsUtils from 'js/AwDiscoveryRecipeChipsUtils';
import { ExtendedTooltip } from 'js/hocCollection';
import _ from 'lodash';

const AwChipHOC = ExtendedTooltip( AwChip );

let destroyObservers = [];

export const attachResizeObserver = (  viewModel, elementRefList ) => {
    //TODO: Need alternate to passing data
    // Just passing the data variables in function does not work as while mounting they may not be assigned and resize callback ends
    // up referring to old values
    const ref = elementRefList.get( 'chiplist' );
    const { dispatch } = viewModel;
    if( resizeObserverSvc.supportsResizeObserver() ) {
        const callback = _.debounce( () => {
            if( ref && ref.current && ref.current.parentElement && ref.current.parentElement.parentElement ) {
                const data = viewModel.getData();
                var overflowReturn = AwDiscoveryRecipeChipsUtils.calculateOverflow( elementRefList, data.visibleChipArea, data.visibleHeightChipArea, data.recipeChips,
                    data.overflowConfig.overflownChips, data.displayRecipeChips, data.searchFilterCategoryExpandMore, false );
                var newOverflowConfig = {
                    overflownChips: overflowReturn.overflownChips,
                    hideMore: true
                };
                dispatch && dispatch( { path: 'data', value:
                     { displayRecipeChips: overflowReturn.displayChips, displayOverflowButton: overflowReturn.displayOverflowButton, overflowConfig: newOverflowConfig } } );
            }
        }, 5, {
            maxWait: 50,
            trailing: true,
            leading: false
        } );
        destroyObservers.push( resizeObserverSvc.observe( ref.current.parentElement.parentElement, callback ) );
    }
};

export const unMount = () => {
    for( const fn of destroyObservers ) {
        fn();
    }
    destroyObservers = [];
};

/**
  * render function for awDiscoveryRecipeChips
  * @param {*} props context for render function interpolation
  * @returns {JSX.Element} react component
  */
export const awDiscoveryRecipeChipsRenderFunction = ( props ) => {
    let enableChips = props.enableChips;
    const { viewModel, actions, elementRefList } = props;
    const { data, i18n } = viewModel;
    let { chipOverflowPopup } = actions;
    let chipCondition = {
        conditions: viewModel.conditions
    };
    const doNothing = () => {
    };

    const showFilterRecipeChipPanel = () =>{
        let loadedVMO = data.displayRecipeChips;
        return (
            <div className='aw-search-breadcrumb-chipsPanel'>
                <div className='aw-layout-flexbox aw-widgets-chipListPanel' ref={elementRefList.get( 'chiplist' )}>
                    { data.displayRecipeChips && data.displayRecipeChips.length > 0 && loadedVMO.map( ( chipModel, index ) => {
                        chipModel.enableWhen = { condition: 'conditions.shouldEnableChips' };
                        if( chipModel.chipFilterType === 'Proximity' ) {
                            const editProximityRecipe = () => {
                                //Open the sub panel to set the recipe input
                                var panelName = chipModel.recipeTerm.criteriaType + 'SubPanel';
                                var eventData = {
                                    nextActiveView: panelName,
                                    recipeOperator: null,
                                    recipeTerm: chipModel.recipeTerm,
                                    spatialRecipeIndexToUpdate: chipModel.recipeTermIndex
                                };
                                eventBus.publish( 'awb0.updateDiscoverySharedDataForPanelNavigation', eventData );
                            };
                            return (
                                <AwChip
                                    chip={chipModel}
                                    action={editProximityRecipe}
                                    uiIconAction={actions.removeFilterAction}
                                    key={index}
                                    chipCondition={chipCondition}>
                                    { chipModel.children && chipModel.children.map( ( chipChildModel, childIndex ) => {
                                        return (
                                            <AwChip
                                                chip={chipChildModel}
                                                action={doNothing()}
                                                uiIconAction={actions.removeFilterAction}
                                                key={childIndex}
                                                chipCondition={chipCondition}>
                                            </AwChip>
                                        );
                                    } )}
                                </AwChip>
                            );
                        }
                        if ( chipModel.recipeTerm.criteriaOperatorType === 'Include' ) {
                            var tooltip = 'IncludeWithoutChildrenTooltip';
                            var context = { labelDisplayName: chipModel.labelDisplayName,
                                showWithoutChildren: chipModel.recipeTerm.criteriaValues[chipModel.recipeTerm.criteriaValues.length - 1] === 'False' };
                            return (
                                <AwChipHOC
                                    chip={chipModel}
                                    action={doNothing()}
                                    uiIconAction={actions.removeFilterAction}
                                    key={index}
                                    chipCondition={chipCondition}
                                    extendedTooltip={tooltip}
                                    extendedTooltipOptions={{ placement: 'right' }}
                                    extendedTooltipContext={context}>
                                    {chipModel.children && chipModel.children.map( ( chipChildModel, childIndex ) => {
                                        return (
                                            <AwChip
                                                chip={chipChildModel}
                                                action={doNothing()}
                                                uiIconAction={actions.removeFilterAction}
                                                key={childIndex}
                                                chipCondition={chipCondition}>
                                            </AwChip>
                                        );
                                    } )}
                                </AwChipHOC>
                            );
                        }
                        return (
                            <AwChip
                                chip={chipModel}
                                action={doNothing()}
                                uiIconAction={actions.removeFilterAction}
                                key={index}
                                chipCondition={chipCondition}>
                                { chipModel.children && chipModel.children.map( ( chipChildModel, childIndex ) => {
                                    return (
                                        <AwChip
                                            chip={chipChildModel}
                                            action={doNothing()}
                                            uiIconAction={actions.removeFilterAction}
                                            key={childIndex}
                                            chipCondition={chipCondition}>
                                        </AwChip>
                                    );
                                } )}
                            </AwChip>
                        );
                    } )}
                    {showClearAll()}
                </div>
            </div>
        );
    };

    const filterChipOverflowPanel = () =>{
        if ( data.overflowConfig.overflownChips && data.overflowConfig.overflownChips.length > 0 ) {
            return (
                <div className ='sw-chip-overflowContainerPanel' ref={chipOverflowPopup.reference}>
                    <AwButton
                        className='sw-chip-overflowButtonPanel'
                        action={openOverflow}
                        closeAction={closePopup}
                        buttonType='chromeless'
                        label= {data.displayOverflowButton}>
                        {data.displayOverflowButton}
                    </AwButton>
                    <AwPopup {...chipOverflowPopup.options}>
                        <div className='aw-layout-flexbox aw-widgets-overflow-chipListPanel sw-column'>
                            { data.overflowConfig.overflownChips.map( ( chipModel, index ) => {
                                chipModel.enableWhen = { condition: 'conditions.shouldEnableChips' };
                                if( chipModel.chipFilterType === 'Proximity' ) {
                                    const editProximityRecipe = () => {
                                        //Open the sub panel to set the recipe input
                                        var panelName = chipModel.recipeTerm.criteriaType + 'SubPanel';
                                        var eventData = {
                                            nextActiveView: panelName,
                                            recipeOperator: null,
                                            recipeTerm: chipModel.recipeTerm,
                                            spatialRecipeIndexToUpdate: chipModel.recipeTermIndex
                                        };
                                        eventBus.publish( 'awb0.updateDiscoverySharedDataForPanelNavigation', eventData );
                                    };
                                    return (
                                        <AwChip
                                            chip={chipModel}
                                            action={editProximityRecipe}
                                            uiIconAction={actions.removeFilterAction}
                                            key={index}
                                            chipCondition={chipCondition}>
                                            { chipModel.children && chipModel.children.map( ( chipChildModel, childIndex ) => {
                                                return (
                                                    <AwChip
                                                        chip={chipChildModel}
                                                        action={doNothing()}
                                                        uiIconAction={actions.removeFilterAction}
                                                        key={childIndex}
                                                        chipCondition={chipCondition}>
                                                    </AwChip>
                                                );
                                            } )}
                                        </AwChip>
                                    );
                                }
                                if ( chipModel.recipeTerm.criteriaOperatorType === 'Include' ) {
                                    var tooltip = 'IncludeWithoutChildrenTooltip';
                                    var context = { labelDisplayName: chipModel.labelDisplayName,
                                        showWithoutChildren: chipModel.recipeTerm.criteriaValues[chipModel.recipeTerm.criteriaValues.length - 1] === 'False' };
                                    return (
                                        <AwChipHOC
                                            chip={chipModel}
                                            action={doNothing()}
                                            uiIconAction={actions.removeFilterAction}
                                            key={index}
                                            chipCondition={chipCondition}
                                            extendedTooltip={tooltip}
                                            extendedTooltipOptions={{ placement: 'right' }}
                                            extendedTooltipContext={context}>
                                            {chipModel.children && chipModel.children.map( ( chipChildModel, childIndex ) => {
                                                return (
                                                    <AwChip
                                                        chip={chipChildModel}
                                                        action={doNothing()}
                                                        uiIconAction={actions.removeFilterAction}
                                                        key={childIndex}
                                                        chipCondition={chipCondition}>
                                                    </AwChip>
                                                );
                                            } )}
                                        </AwChipHOC>
                                    );
                                }
                                return (
                                    <AwChip
                                        chip={chipModel}
                                        action={doNothing()}
                                        uiIconAction={actions.removeFilterAction}
                                        key={index}
                                        chipCondition={chipCondition}>
                                        { chipModel.children && chipModel.children.map( ( chipChildModel, childIndex ) => {
                                            return (
                                                <AwChip
                                                    chip={chipChildModel}
                                                    action={doNothing()}
                                                    uiIconAction={actions.removeFilterAction}
                                                    key={childIndex}
                                                    chipCondition={chipCondition}>
                                                </AwChip>
                                            );
                                        } )}
                                    </AwChip>
                                );
                            } )}
                        </div>
                    </AwPopup>
                </div>
            );
        }
    };

    const openOverflow = () => {
        if( !chipOverflowPopup.open ) {
            chipOverflowPopup.show( {
                width: 'auto',
                height: 'auto'
            } );
        }
    };

    const closePopup = () => {
        chipOverflowPopup.hide();
    };

    const showClearAll = () =>{
        if ( data.displayRecipeChips && data.displayRecipeChips.length > 0 ) {
            return (
                <>
                    { filterChipOverflowPanel()}
                    {
                        enableChips &&
                         <AwButton className='aw-search-clearAll' buttonType='chromeless' action={actions.clearAllConfirmationMessage}>{i18n.ClearText}</AwButton>
                    }

                </>
            );
        }
        return null;
    };

    return (
        <>
            {showFilterRecipeChipPanel()}
        </>
    );
};

const AwDiscoveryRecipeChipsService = {
    attachResizeObserver,
    unMount
};

export default AwDiscoveryRecipeChipsService;


