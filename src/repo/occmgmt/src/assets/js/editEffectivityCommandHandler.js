// Copyright (c) 2022 Siemens

/**
 * This is the command handler for "Edit Effectivity" cell command
 *
 * @module js/editEffectivityCommandHandler
 */
import eventBus from 'js/eventBus';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import occmgmtUtils from 'js/occmgmtUtils';

var exports = {};

var setEndItem = function( uid, object_string, commandContext ) {
    var item = cdm.getObject( uid );
    let sharedData = { ...commandContext.getValue() };
    sharedData.endItemVal.endItem = {
        type : item.type || '',
        uid : item.uid || '',
        dbValue : object_string
    };

    commandContext.update( { ...sharedData } );
};

export let populateEditEffectivityProperties = function( vmo, sharedData ) {
    var editEffectivityCtx = appCtxSvc.getCtx( 'editEffectivityContext' );
    var editEffectivityContext = editEffectivityCtx ? editEffectivityCtx : {};

    let sharedDataValue = { ...sharedData.getValue() };

    sharedDataValue.selectedCell.uid = vmo.uid;
    sharedDataValue.selectedCell.type = vmo.type;
    var uid = vmo.uid;
    var effProps = editEffectivityContext.responseObjects[uid].props;

    if( effProps.effectivity_dates.dbValues[ 0 ] ) {
        //edit date effectivity
        sharedDataValue.dateOrUnitEffectivityTypeRadioButton.dbValue = true;
        sharedDataValue.nameBox.dbValue = effProps.effectivity_id.dbValues[ 0 ] ? effProps.effectivity_id.dbValues[ 0 ] : '';
        sharedDataValue.isShared.dbValue = Boolean( effProps.effectivity_id.dbValues[ 0 ] );
        sharedDataValue.startDate.dbValue = new Date( effProps.effectivity_dates.dbValues[ 0 ] ).getTime();
        sharedDataValue.endDate.dbValue = effProps.effectivity_dates.dbValues[ 1 ]  ? new Date( effProps.effectivity_dates.dbValues[ 1 ] ).getTime() : '';
        sharedDataValue.endDateOptions.dbValue = effProps.effectivity_dates.dbValues[ 1 ] ? 'Date' : effProps.range_text.dbValues[ 0 ].indexOf( 'UP' ) > -1 ? 'UP' : 'SO';
        if(  sharedDataValue.endDateOptions.dbValue === 'UP' ) {
            occmgmtUtils.setLocalizedValue( sharedDataValue.endDateOptions, 'uiValue', 'upTextValue' );
        } else if(  sharedDataValue.endDateOptions.dbValue === 'SO' ) {
            occmgmtUtils.setLocalizedValue( sharedDataValue.endDateOptions, 'uiValue', 'soTextValue' );
        } else {
            occmgmtUtils.setLocalizedValue( sharedDataValue.endDateOptions, 'uiValue', 'dateEffectivity' );
        }
    } else {
        //edit unit effectivity
        sharedDataValue.dateOrUnitEffectivityTypeRadioButton.dbValue = false;
        sharedDataValue.nameBoxForUnit.dbValue = effProps.effectivity_id.dbValues[ 0 ] ? effProps.effectivity_id.dbValues[ 0 ] : '';
        sharedDataValue.isSharedForUnit.dbValue = Boolean( effProps.effectivity_id.dbValues[ 0 ] );
        sharedDataValue.unitRangeText.dbValue = effProps.range_text.dbValues[ 0 ];
        var itemOrRevProp = effProps.end_item_rev.dbValues[ 0 ] ? effProps.end_item_rev : effProps.end_item;
        if( itemOrRevProp.dbValues[0] ) {
            sharedDataValue.endItemVal.uiValue = itemOrRevProp.uiValues[ 0 ];
            sharedDataValue.endItemVal.dbValue = itemOrRevProp.uiValues[ 0 ];
            setEndItem( itemOrRevProp.dbValues[0], itemOrRevProp.uiValues[ 0 ], sharedData );
        }
    }

    sharedDataValue.isProtected.dbValue = effProps.effectivity_protection.dbValues[ 0 ] === '1';
    sharedData.update( { ...sharedDataValue } );
};

/**
 * Execute the command.
 */
export let execute = function( vmo ) {
    eventBus.publish( 'navigateToEditPanel', vmo );
};
/**
 * "Edit Effectivity" cell command handler factory
 *
 * @member editEffectivityCommandHandler
 */
export default exports = {
    execute,
    populateEditEffectivityProperties
};
