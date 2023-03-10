// Copyright (c) 2022 Siemens

/**
 * This is the command handler for "Edit Group Effectivity" cell command
 *
 * @module js/editGroupEffectivityCommandHandler
 */
import nestedNavigationPanelService from 'js/nestedNavigationPanelService';

var exports = {};

export let getDateRangeEditContext = function( vmo, i18n ) {
    let inputDates = vmo.cellHeader2.split( '(' )[ 0 ].split( 'to' );
    let startDateTime = new Date( inputDates[ 0 ] ).getTime();
    let endDateTime = inputDates[ 1 ].includes( 'UP' ) || inputDates[ 1 ].includes( 'SO' ) ? '' : new Date( inputDates[ 1 ] ).getTime();
    let endDateOptions = inputDates[ 1 ].trim();
    let endDateOptionsUiValue;
    if( endDateOptions === 'UP' ) {
        endDateOptionsUiValue = i18n.upText;
    } else if( endDateOptions === 'SO' ) {
        endDateOptionsUiValue = i18n.soText;
    } else {
        endDateOptionsUiValue = i18n.dateEffectivity;
    }

    return {
        nameBox: vmo.cellHeader1,
        effectivity : vmo.props.Fnd0EffectivityList.dbValues[ 0 ],
        groupRevision : vmo.uid,
        groupRevisionType: vmo.type,
        startDateTime,
        endDateTime,
        endDateOptions,
        endDateOptionsUiValue

    };
};

/**
 * Execute the command.
 */
export let execute = function( vmo, subPanelContext, title ) {
    let isDateRangeEffectivity = vmo.cellHeader2.split( '(' )[ 0 ].includes( 'to' );
    let panelId = isDateRangeEffectivity ? 'EditDateRangeGroupEffectivity' : 'EditGroupEffectivity';
    nestedNavigationPanelService.navigateToView( subPanelContext.nestedNavigationState, {
        panelId: panelId,
        title: title,
        additionalSubPanelContext: { vmo: vmo, shouldClosePanelOnApply: subPanelContext.shouldClosePanelOnApply }
    } );

    subPanelContext.nestedNavigationState.update( { views: subPanelContext.nestedNavigationState.getValue().views, nameBoxForEdit: vmo.cellHeader1 } );
};

/**
 * "Edit Group Effectivity" cell command handler factory
 *
 * @member editGroupEffectivityCommandHandler
 */
export default exports = {
    execute,
    getDateRangeEditContext
};
