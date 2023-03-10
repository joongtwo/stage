// Copyright (c) 2022 Siemens

/**
 * @module js/aceEffectivityService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import sharedEffSvc from 'js/sharedEffectivityService';
import dateEffConfigSvc from 'js/dateEffectivityConfigurationService';
import eventBus from 'js/eventBus';

var exports = {};

export let updateEndItemWidgetVisibility = function( data, subPanelContext ) {
    var locationContext = appCtxSvc.getCtx( 'locationContext.ActiveWorkspace:SubLocation' );
    if( locationContext === 'com.siemens.splm.client.occmgmt:OccurrenceManagementSubLocation' && ( data.flag.dbValue === 'AUTHOR' || !data.unitRangeText.dbValue ) ) {
        sharedEffSvc.loadTopLevelAsEndItem( data, subPanelContext );
    }
};

/**
    * Get initial date effectivity configuration
    *
    * @param {Object} data - data
    */
export let getInitialDateEffectivityConfigurationData = function( data, occContext ) {
    var dateTimeInfo = dateEffConfigSvc.getInitialDateEffectivityConfigurationData( data, occContext );
    return { currentEffectiveDate: dateTimeInfo.currentEffectiveDate, isTimeEnabled: dateTimeInfo.isTimeEnabled, dateTimeFormat: dateTimeInfo.dateTimeFormat };
};

/**
    * Validate Unit values
    * @param {Object} data - data
    *  @param {Object} subPanelContext - subPanelContext
    */
export let validateAndUpdateUnitValue = function( data, subPanelContext ) {
    if( data.unitRangeText.dbValue ) {
        let sharedData = { ...subPanelContext.value };
        var isUnitRangeValid = true;
        var isBadSyntax = false;
        var isPositiveNumber = true;
        var isTooLarge = false;
        var modifiedUnitRangeText;
        var finalFirstNum;

        var unitValue = data.unitRangeText.dbValue;
        var clean = unitValue;

        if( clean ) {
            clean = clean.replace( '/\s+/g', '' ); //remove all spaces from the given string

            if( clean !== null && clean !== '' ) {
                var unitInParts = clean.split( ',' );
                var lastValue = -1;
                var i = 0;
                for( i = 0; i < unitInParts.length; i++ ) {
                    var units = unitInParts[ i ].split( '-' );

                    // if range is given even after UP or SO, lastValue will be NaN
                    // pattern like 10-15-20 is invalid
                    if( isNaN( lastValue ) ) {
                        isUnitRangeValid = false;
                        break;
                    } else if( units.length > 2 ) {
                        isBadSyntax = true;
                        break;
                    }

                    // CHeck if first number starts with zero.
                    var firstNumber = units[ 0 ];

                    //var num = Array.from(firstNumber);
                    if( units[ 0 ] ) {
                        finalFirstNum = units[ 0 ].trim().replace( /^0+/, '' );
                        if( finalFirstNum === '' ) {
                            finalFirstNum = 0;
                        }
                    }

                    var isFirstNumberInteger = Number.isInteger( Number( firstNumber ) );

                    // check 1st part is number or if it is a negative number
                    if( isNaN( units[ 0 ] ) || units[ 0 ] === '' || !isFirstNumberInteger || _.endsWith( units[0], '.' ) ) {
                        isPositiveNumber = false;
                    } else if( Number( units[ 0 ] ) <= lastValue ) {
                        isUnitRangeValid = false;
                    } else if( parseInt( units[ 0 ] ) > 2147483647 ) {
                        isTooLarge = true;
                    }

                    lastValue = Number( units[ 0 ] ); // update last value


                    // if there is second part
                    if( units.length > 1 ) {
                        // check 2nd part is float
                        var secondNumber = units[ 1 ];
                        var isSecondNumberInteger = Number.isInteger( Number( secondNumber ) );

                        // check 1st part is number
                        if( isNaN( units[ 1 ] ) ) {
                            if( units[ 1 ] !== 'UP' && units[ 1 ] !== 'SO' ) {
                                isPositiveNumber = false;
                            }
                        } else if( !isSecondNumberInteger || _.endsWith( units[1], '.' ) ) {
                            isPositiveNumber = false;
                        } else if( Number( units[ 1 ] ) <= lastValue ) {
                            isUnitRangeValid = false;
                        } else if( parseInt( units[ 1 ] ) > 2147483647 ) {
                            isTooLarge = true;
                        }

                        lastValue = Number( units[ 1 ] );
                    }
                }
            }
        }
        if( !_.includes( unitValue, '-' ) && finalFirstNum === 0 ) {
            isPositiveNumber = false;
        }

        modifiedUnitRangeText = unitValue.replace( /\b0+/g, '' );

        // From above step all preceeding 0's are removed. So if only 0-20 is added as input then -20 will remain, in this case we need to add removed 0.
        if( _.includes( unitValue, '-' ) && modifiedUnitRangeText.charAt( 0 ) === '-' ) {
            modifiedUnitRangeText = 0 + modifiedUnitRangeText;
        }

        sharedData.unitRangeText.dbValue = modifiedUnitRangeText;
        subPanelContext.update( { ...sharedData } );

        return {
            isUnitRangeValid : isUnitRangeValid,
            isBadSyntax : isBadSyntax,
            isPositiveNumber : isPositiveNumber,
            isTooLarge : isTooLarge,
            modifiedUnitRangeText : modifiedUnitRangeText
        };
    }
};

export const setActiveView = ( destinationPanelId, data ) => {
    let sharedData = data.sharedData;
    sharedData.previousView = sharedData.activeView;
    sharedData.activeView = destinationPanelId;
    return sharedData;
};

export let updateRadioBtnValueOnState = ( subPanelContext ) => {
    let sharedData = { ...subPanelContext.value };
    var value = sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue;
    if( value ) {
        sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue = false;
    } else {
        sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue = true;
    }
    subPanelContext.update( { ...sharedData } );
    return sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue;
};

export var clearUnitEffectivityFields = function( data, subPanelContext ) {
    if( subPanelContext.sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue ) {
        let sharedData = subPanelContext.sharedData;
        let sharedDataValue = { ...sharedData.getValue() };
        sharedDataValue.nameBoxForUnit.dbValue = null;
        sharedDataValue.unitRangeText.dbValue = null;
        sharedDataValue.isSharedForUnit.dbValue = false;
        sharedData.update( { ...sharedDataValue } );
        updateEndItemWidgetVisibility( data, subPanelContext );
    }
};

export let updateUnitEffectivityStateToDefault = ( subPanelContext ) => {
    let sharedData = { ...subPanelContext.getValue() };
    sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue = true;
    sharedData.unitRangeText.dbValue = null;
    sharedData.nameBoxForUnit.dbValue = null;
    sharedData.isSharedForUnit.dbValue = false;

    sharedData.isProtected.dbValue = false;
    subPanelContext.update( { ...sharedData } );

    return sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue;
};

export let updateDateEffectivityStateToDefault = ( subPanelContext ) => {
    let sharedData = { ...subPanelContext.getValue() };
    sharedData.isShared.dbValue = false;
    sharedData.nameBox.dbValue = null;
    sharedData.startDate.dbValue = null;
    sharedData.endDate.dbValue = null;
    sharedData.endDateOptions.dbValue = 'Date';
    sharedData.endDateOptions.uiValue = 'Date';
    subPanelContext.update( { ...sharedData } );
};

export let updateNameBox = ( fields, fieldName, data ) => {
    let nameBoxUpdated = {};
    nameBoxUpdated = { ...data.nameBox };
    let checkBoxVal = fields.isShared.value;

    if( checkBoxVal === true ) {
        nameBoxUpdated.isRequired = true;
        data.dispatch( { path: 'data.nameBox', value: nameBoxUpdated } );
    } else {
        nameBoxUpdated.isRequired = false;
        data.dispatch( { path: 'data.nameBox', value: nameBoxUpdated } );
    }
};

export let updateNameBoxForUnit = ( fields, fieldName, data ) => {
    let nameBoxUpdated = {};
    nameBoxUpdated = { ...data.nameBoxForUnit };
    let checkBoxVal = fields.isSharedForUnit.value;

    if( checkBoxVal === true ) {
        nameBoxUpdated.isRequired = true;
        data.dispatch( { path: 'data.nameBoxForUnit', value: nameBoxUpdated } );
    } else {
        nameBoxUpdated.isRequired = false;
        data.dispatch( { path: 'data.nameBoxForUnit', value: nameBoxUpdated } );
    }
};

export let updateDateWidgetType = ( subPanelContext, data )=> {
    let sharedData = subPanelContext.sharedData;
    let sharedDataValue = { ...sharedData.getValue() };
    if( data.isTimeEnabled ) {
        sharedDataValue.endDate.type = 'DATETIME';
        sharedDataValue.isTimeEnabled.value = true;
    } else{
        sharedDataValue.endDate.type = 'DATE';
        sharedDataValue.isTimeEnabled.value = false;
    }
    sharedData.update( { ...sharedDataValue } );
};

export let updateProtectCheckBoxOnData = ( sharedData, data ) => {
    let protectedValue = { ...data.isProtected };
    protectedValue.dbValue = sharedData.isProtected.dbValue;
    return protectedValue.dbValue;
};

export default exports = {
    updateEndItemWidgetVisibility,
    getInitialDateEffectivityConfigurationData,
    validateAndUpdateUnitValue,
    setActiveView,
    updateRadioBtnValueOnState,
    updateUnitEffectivityStateToDefault,
    updateNameBox,
    updateNameBoxForUnit,
    updateDateWidgetType,
    updateDateEffectivityStateToDefault,
    clearUnitEffectivityFields,
    updateProtectCheckBoxOnData
};
