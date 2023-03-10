// Copyright (c) 2022 Siemens

/**
 * @module js/Pca0AddFreeFormOptionValue
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import commandPanelService from 'js/commandPanel.service';
import dataManagementSvc from 'soa/dataManagementService';
import dateTimeService from 'js/dateTimeService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import Pca0Constants from './Pca0Constants';
import viewModelObjectService from 'js/viewModelObjectService';

import _ from 'lodash';

var _sourceID = '';
/**
 * Publish event to notify creation/update of new Free Form value/Enumerated Range expression
 * @param {String} valueText - value created/update
 * @param {Boolean} isFreeForm - value created/update
 */
let _notifyValueChange = function( valueText, isFreeForm ) {
    var eventData = {
        sourceID: _sourceID,
        valueText: valueText,
        isFreeForm: isFreeForm
    };
    let panelCtx = appCtxSvc.getCtx( 'panelContext' );
    if( !panelCtx.updateRange ) {
        eventBus.publish( 'Pca0AddFreeFormOptionValue.valueCreated', eventData );
    } else {
        eventData.oldValueText = panelCtx.commandContext.value.dbValue;
        eventBus.publish( 'Pca0AddFreeFormOptionValue.valueUpdated', eventData );
    }
};

/**
 * Update panel view data for Grid view
 * @param {Object} data VM data
 */
let _updateRequireViewDataForGrid = function( data ) {
    if( data.isFreeFormFamily.dbValue ) {
        data.fromListValues.OperatorValues.unshift( {
            propInternalValue: '=',
            dispValue: '=',
            propDisplayValue: '=',
            propDisplayDescription: ''
        } );

        data.fromDateValues.OperatorValues.unshift( {
            propInternalValue: '=',
            dispValue: '=',
            propDisplayValue: '=',
            propDisplayDescription: ''
        } );
    }
};

/**
 * Util to initialize the View for Enumerated Range for Grid
 * @param {Object} data VM data
 * @param {Object} gridSelectionState Grid selection state container - Atomic data
 */
let _initEnumRangeForGridView = ( data, gridSelectionState ) => {
    let displayValues = [];
    let idValues = [];
    let sortedIdValues = [];

    if( gridSelectionState.selectionInfo.childrenDispValues &&
        gridSelectionState.selectionInfo.cfg0ChildrenIDs ) {
        displayValues = _.cloneDeep( gridSelectionState.selectionInfo.childrenDispValues );
        idValues = _.cloneDeep( gridSelectionState.selectionInfo.cfg0ChildrenIDs );
    }
    if( !gridSelectionState.isFreeFormOptionValueSelected && !_.isEmpty( gridSelectionState.selectionInfo.cfg0ChildrenIDs ) ) {
        sortedIdValues = gridSelectionState.selectionInfo.cfg0ChildrenIDs;
        // This will ensure that From and To ListBox populated in Add Feature Panel are sorted
        if( gridSelectionState.selectionInfo.type === 'Date' ) {
            sortedIdValues.sort( function( a, b ) {
                return new Date( a ) - new Date( b );
            } );
        } else if( gridSelectionState.selectionInfo.type === 'Integer' ) {
            // Sort children array when family type is Integer
            sortedIdValues.sort( function( a, b ) {
                return parseInt( a, 10 ) - parseInt( b, 10 );
            } );
        } else if( gridSelectionState.selectionInfo.type === 'Floating Point' ) {
            // Sort children array when family type is Floating Point
            sortedIdValues.sort( function( a, b ) {
                return parseFloat( a, 10 ) - parseFloat( b, 10 );
            } );
        }
        for( var i = 0; i < sortedIdValues.length; i++ ) {
            const idIndex = idValues.indexOf( sortedIdValues[ i ] );
            let displayName = displayValues[ idIndex ];
            if( gridSelectionState.selectionInfo.type === 'Date' && pca0CommonUtils.isUTCFormatString( displayName ) ) {
                let formatedDateInUTC = dateTimeService.formatUTC( displayName );
                let formattedDate = dateTimeService.formatDate( formatedDateInUTC );
                displayName = formattedDate;
            }
            let lovObj = {
                dispValue: displayName,
                propDisplayValue: displayName,
                propDisplayDescription: '',
                propInternalValue: displayName
            };
            if( lovObj.dispValue ) {
                data.fromChildListValues.childValues.push( lovObj );
                data.toChildListValues.childValues.push( lovObj );
            }
        }
    }
};

/**
 * Util to initialize the View for Enumerated Range for VCV List view
 * @param {Object} data VM data
 * @param {Object} cmdCtx CommandContext container used in List view
 */
let _initEnumRangeForVCVList = ( data, cmdCtx ) => {
    let displayValues = [];
    let idValues = [];
    let sortedIdValues = [];
    if( cmdCtx.family.childrenDispValues && cmdCtx.family.cfg0ChildrenIDs ) {
        displayValues = _.cloneDeep( cmdCtx.family.childrenDispValues );
        idValues = _.cloneDeep( cmdCtx.family.cfg0ChildrenIDs );
    }
    if( !cmdCtx.family.isFreeForm && !_.isEmpty( cmdCtx.family.cfg0ChildrenIDs ) ) {
        sortedIdValues = cmdCtx.family.cfg0ChildrenIDs;
        // This will ensure that From and To ListBox populated in Add Feature Panel are sorted
        if( cmdCtx.family.familyType === 'Date' ) {
            sortedIdValues.sort( function( a, b ) {
                return new Date( a ) - new Date( b );
            } );
        } else if( cmdCtx.family.familyType === 'Integer' ) {
            // Sort children array when family type is Integer
            sortedIdValues.sort( function( a, b ) {
                return parseInt( a, 10 ) - parseInt( b, 10 );
            } );
        } else if( cmdCtx.family.familyType === 'Floating Point' ) {
            // Sort children array when family type is Floating Point
            sortedIdValues.sort( function( a, b ) {
                return parseFloat( a, 10 ) - parseFloat( b, 10 );
            } );
        }
        for( var i = 0; i < sortedIdValues.length; i++ ) {
            const idIndex = idValues.indexOf( sortedIdValues[ i ] );
            let displayName = displayValues[ idIndex ];
            if( cmdCtx.family.familyType === 'Date' && pca0CommonUtils.isUTCFormatString( displayName ) ) {
                let formatedDateInUTC = dateTimeService.formatUTC( displayName );
                let formattedDate = dateTimeService.formatDate( formatedDateInUTC );
                displayName = formattedDate;
            }
            let lovObj = {
                dispValue: displayName,
                propDisplayValue: displayName,
                propDisplayDescription: '',
                propInternalValue: displayName
            };
            if( lovObj.dispValue ) {
                data.fromChildListValues.childValues.push( lovObj );
                data.toChildListValues.childValues.push( lovObj );
            }
        }
    }
};

/**
 * Initialize View Data with value from Command Context - VCV List View
 *  @param {Object} data - VM data object
 *  @param {Object} cmdCtx - command context
 */
let _initializeViewDataFromCmdCtxVCVList = function( data, cmdCtx ) {
    let feature = cmdCtx.value.dbValue;
    if( feature.toString().search( />=|<|>|<=/ ) >= 0 ) {
        let dateExpr = feature.split( ' ' );
        if( dateExpr[ 1 ] ) {
            let fromOp = '';
            let toOp = '';
            let toVal = '';
            let fromVal = '';
            fromOp = dateExpr[ 0 ];
            fromVal = dateExpr[ 1 ];
            data.fromOperator.dbValue = fromOp;
            data.fromOperator.uiValue = fromOp;
            if( data.typeOfFamily.dbValue === 'Integer' ) {
                data.fromIntegerValue.dbValue = fromVal;
                data.fromIntegerValue.uiValue = fromVal;
                if( data.fromEnumValues ) {
                    data.fromEnumValues.dbValue = fromVal;
                    data.fromEnumValues.uiValue = fromVal;
                }
            }
            if( data.typeOfFamily.dbValue === 'Floating Point' ) {
                data.fromDoubleValue.dbValue = fromVal;
                data.fromDoubleValue.uiValue = fromVal;
                if( data.fromEnumValues ) {
                    data.fromEnumValues.dbValue = fromVal;
                    data.fromEnumValues.uiValue = fromVal;
                }
            }
            if( cmdCtx.family.familyType === 'Date' && pca0CommonUtils.isUTCFormatString( fromVal ) ) {
                fromVal = fromVal.split( 'T' )[ 0 ];
                let formatedFromDate = dateTimeService.formatDate( fromVal );
                data.fromDateTime.dbValue = Date.parse( formatedFromDate );
                data.fromDateTime.uiValue = formatedFromDate;
                if( data.fromEnumValues ) {
                    data.fromEnumValues.dbValue = formatedFromDate;
                    data.fromEnumValues.uiValue = formatedFromDate;
                }
            }
            if( dateExpr[ 3 ] ) {
                toOp = dateExpr[ 3 ];
                toVal = dateExpr[ 4 ];
                data.toOperator.dbValue = toOp;
                data.toOperator.uiValue = toOp;
                if( data.typeOfFamily.dbValue === 'Integer' ) {
                    data.toIntegerValue.dbValue = toVal;
                    data.toIntegerValue.uiValue = toVal;
                    if( data.toEnumValues ) {
                        data.toEnumValues.dbValue = toVal;
                        data.toEnumValues.uiValue = toVal;
                    }
                }
                if( data.typeOfFamily.dbValue === 'Floating Point' ) {
                    data.toDoubleValue.dbValue = toVal;
                    data.toDoubleValue.uiValue = toVal;
                    if( data.toEnumValues ) {
                        data.toEnumValues.dbValue = toVal;
                        data.toEnumValues.uiValue = toVal;
                    }
                }
                if( cmdCtx.family.familyType === 'Date' ) {
                    toVal = toVal.split( 'T' )[ 0 ];
                    let formatedToDate = dateTimeService.formatDate( toVal );
                    data.toDateTime.dbValue = Date.parse( formatedToDate );
                    data.toDateTime.uiValue = formatedToDate;
                    if( data.toEnumValues ) {
                        data.toEnumValues.dbValue = formatedToDate;
                        data.toEnumValues.uiValue = formatedToDate;
                    }
                }
            }
        }
        if( data.typeOfFamily.dbValue === 'String' ) {
            data.freeFormStringValue.dbValue = feature;
            data.freeFormStringValue.uiValue = feature;
        }
    }
};

/**
 * Close the add free form option value panel.
 * @param {Object} data VM data
 */
let closeAddFreeFormOptionValuePanel = function( data ) {
    if( data.subPanelContext && !data.subPanelContext.panelPinned ) {
        var eventData = {
            source: 'toolAndInfoPanel'
        };
        eventBus.publish( 'complete', eventData );
    }
};

var exports = {};

/**
 * Open the Command Panel to Add/Edit a FreeForm/Enumerated value.
 * @param {string} commandId panel id
 * @param {string} location panel location
 * @param {Object} panelContext panel context
 * @param {Object} config panel configuration
 */
export let openAddFreeFormEnumeratedValuePanel = function( commandId, location, panelContext, config ) {
    _sourceID = panelContext.sourceID;

    if( _.isUndefined( panelContext.commandContext.group ) ) { panelContext.commandContext.group = {}; }
    if( _.isUndefined( panelContext.commandContext.value ) ) { panelContext.commandContext.value = {}; }

    commandPanelService.activateCommandPanel( commandId, location, panelContext, null, null, config );
};

/**
 * Initialize the properties of view data by using command context
 * @param {Object} viewModel - VM Data
 * @returns {Object} viewModel data
 */
export let initFreeForm = function( viewModel ) {
    let data = { ...viewModel.data };
    let panelCtx = appCtxSvc.getCtx( 'panelContext' );

    // From Grids, update view data based on Grid Selection State
    if( _sourceID === Pca0Constants.GRID_CONSTANTS.VARIANT_CONDITION ) {
        let gridSelectionState = panelCtx.commandContext.gridSelectionState.value;
        data.typeOfFamily.dbValue = gridSelectionState.selectionInfo.type;
        data.nameOfFamily.dbValue = gridSelectionState.selectionInfo.displayName;
        data.isFreeFormFamily.dbValue = gridSelectionState.isFreeFormOptionValueSelected;

        _updateRequireViewDataForGrid( data );
    }

    // Use old code with CTX update for VCV
    if( _sourceID === 'fscFreeFormRangeExpPanel' ) {
        let cmdCtx = panelCtx.commandContext;
        appCtxSvc.updatePartialCtx( panelCtx.contextKey + '.isFreeFormCtx.commandContext', cmdCtx );
        data.typeOfFamily.dbValue = cmdCtx.family.familyType;
        data.nameOfFamily.dbValue = cmdCtx.family.familyDisplayName;
        data.isFreeFormFamily.dbValue = cmdCtx.family.isFreeForm;

        // From List view, initialize data based on given Value, if available (Value Edit Mode)
        if( ( cmdCtx.family.isFreeForm || panelCtx.updateRange ) && !_.isEmpty( cmdCtx.value ) ) {
            _initializeViewDataFromCmdCtxVCVList( data, cmdCtx );
        }
    }

    return {
        typeOfFamily: data.typeOfFamily,
        nameOfFamily: data.nameOfFamily,
        isFreeFormFamily: data.isFreeFormFamily,
        fromOperator: data.fromOperator,
        toOperator: data.toOperator,
        fromIntegerValue: data.fromIntegerValue,
        toIntegerValue: data.toIntegerValue,
        fromDoubleValue: data.fromDoubleValue,
        toDoubleValue: data.toDoubleValue,
        fromDateTime: data.fromDateTime,
        toDateTime: data.toDateTime,
        fromListValues: data.fromListValues,
        toListValues: data.toListValues,
        freeFormStringValue: data.freeFormStringValue
    };
};

/**
 * Populate VM data to show family name in panel
 */
export let loadFamilyInPanel = async function() {
    let panelCtx = appCtxSvc.getCtx( 'panelContext' );
    let vmoObj = {};
    let familyStr;

    // From Grids, update view data based on Grid Selection State
    if( _sourceID === Pca0Constants.GRID_CONSTANTS.VARIANT_CONDITION ) {
        let gridSelectionState = panelCtx.commandContext.gridSelectionState.value;
        familyStr = gridSelectionState.selectionInfo.id;
    }
    // Use old code with CTX update for VCV
    if( _sourceID === 'fscFreeFormRangeExpPanel' ) {
        let cmdCtx = panelCtx.commandContext;
        familyStr = cmdCtx.family.familyStr;
    }

    await dataManagementSvc.loadObjects( [ familyStr ] );
    let oUidObject = cdm.getObject( familyStr );
    vmoObj = viewModelObjectService.createViewModelObject( oUidObject );
    return vmoObj;
};

/**
 * Add Integer-type freeform option value or enumerated range expression.
 * @param {Object} data VM data
 */
export let addIntegerValue = function( data ) {
    var finalValue;
    var fromOp = data.fromOperator.dbValue;
    var fromVal = data.fromIntegerValue.dbValue;
    var toOp = data.toOperator.dbValue;
    var toVal = data.toIntegerValue.dbValue;
    if( data.isFreeFormFamily && !data.isFreeFormFamily.dbValue ) {
        fromVal = data.fromEnumValues.dbValue;
        toVal = data.toEnumValues.dbValue;
        if( data.toChildListValues.childValues.length === 0 ) {
            toVal = '';
        }
    }
    if( toOp !== '--' && toVal && ( fromOp === '>' || fromOp === '>=' ) ) {
        const localeTextBundle = localeService.getLoadedText( 'ConfiguratorMessages' );
        if( Number( fromVal ) > Number( toVal ) ) {
            messagingService.showError( localeTextBundle.showRangeError );
            return;
        }
        finalValue = fromOp + ' ' + fromVal + ' & ' + toOp + ' ' + toVal;
    } else if( fromOp !== '=' ) {
        finalValue = fromOp + ' ' + fromVal;
    } else {
        finalValue = String( fromVal );
    }
    closeAddFreeFormOptionValuePanel( data );
    _notifyValueChange( finalValue, data.isFreeFormFamily.dbValue );
};

/**
 * Add String free form option value.
 * @param {Object} data VM data
 * */
export let addStringValue = function( data ) {
    var finalValue = data.freeFormStringValue.dbValue;
    closeAddFreeFormOptionValuePanel( data );
    _notifyValueChange( finalValue, data.isFreeFormFamily.dbValue );
};

/**
 * Add Double-type freeform option value or enumerated range expression.
 * @param {Object} data VM data
 */
export let addDoubleValue = function( data ) {
    var finalValue;
    var fromOp = data.fromOperator.dbValue;
    var fromVal = data.fromDoubleValue.dbValue;
    var toOp = data.toOperator.dbValue;
    var toVal = data.toDoubleValue.dbValue;
    if( data.isFreeFormFamily && !data.isFreeFormFamily.dbValue ) {
        fromVal = data.fromEnumValues.dbValue;
        toVal = data.toEnumValues.dbValue;
        if( data.toChildListValues.childValues.length === 0 ) {
            toVal = '';
        }
    }
    if( toOp !== '--' && toVal && ( fromOp === '>' || fromOp === '>=' ) ) {
        const localeTextBundle = localeService.getLoadedText( 'ConfiguratorMessages' );
        if( Number( fromVal ) > Number( toVal ) ) {
            messagingService.showError( localeTextBundle.showRangeError );
            return;
        }
        finalValue = fromOp + ' ' + fromVal + ' & ' + toOp + ' ' + toVal;
    } else if( fromOp !== '=' ) {
        finalValue = fromOp + ' ' + fromVal;
    } else {
        finalValue = String( fromVal );
    }
    closeAddFreeFormOptionValuePanel( data );
    _notifyValueChange( finalValue, data.isFreeFormFamily.dbValue );
};

/**
 * Add Date-type freeform option value or enumerated range expression.
 * @param {Object} data VM data
 */
export let addDateValue = function( data ) {
    var finalValue;
    var fromOp = data.fromOperator.dbValue;
    var fromDate = data.fromDateTime.uiValue.split( ' ' )[ 0 ];
    var formatedFromDateInUTC = dateTimeService.formatUTC( fromDate );
    var formattedFromDate = dateTimeService.formatDate( formatedFromDateInUTC );
    var toOp = data.toOperator.dbValue;
    var toDate = data.toDateTime.uiValue.split( ' ' )[ 0 ];
    var formattedToDateInUTC = dateTimeService.formatUTC( toDate );
    var formattedToDate = dateTimeService.formatDate( formattedToDateInUTC );
    if( data.isFreeFormFamily && !data.isFreeFormFamily.dbValue ) {
        formattedFromDate = pca0CommonUtils.isUTCFormatString( data.fromEnumValues.dbValue ) ? dateTimeService.formatUTC( Date.parse( data.fromEnumValues.dbValue ) ) : data.fromEnumValues.dbValue;
        formattedToDate = pca0CommonUtils.isUTCFormatString( data.toEnumValues.dbValue ) ? dateTimeService.formatUTC( Date.parse( data.toEnumValues.dbValue ) ) : data.toEnumValues.dbValue;
        if( data.toChildListValues.childValues.length === 0 ) {
            formattedToDate = '';
        }
    }
    if( toOp !== '--' && formattedToDate !== '' && ( fromOp === '>' || fromOp === '>=' ) ) {
        const localeTextBundle = localeService.getLoadedText( 'ConfiguratorMessages' );
        if( Date.parse( new Date( formattedFromDate ) ) > Date.parse( new Date( formattedToDate ) ) ) {
            messagingService.showError( localeTextBundle.showRangeError );
            return;
        }
        finalValue = fromOp + ' ' + formattedFromDate + ' & ' + toOp + ' ' + formattedToDate;
    } else if( fromOp !== '=' ) {
        finalValue = fromOp + ' ' + formattedFromDate;
    } else {
        finalValue = String( formattedFromDate );
    }
    closeAddFreeFormOptionValuePanel( data );
    _notifyValueChange( finalValue, data.isFreeFormFamily.dbValue );
};

/**
 * Generate Preview for the expressions selected on panel
 * @param {Object} data VM data
 * @returns {Object} operator and preview value
 */
export let selectionChangeFreeForm = function( data ) {
    //the from and to lists are always the same, from is always the full list
    let fromVal = '';
    let fromOperator = '';
    let toVal = '';
    let toOperator = '';
    let andOperator = '';
    let toPreview = '';
    let fromPreview = '';
    let dataPreviewUIVal = '';
    fromOperator = data.fromOperator.dbValue;

    if( data.fromIntegerValue && data.fromIntegerValue.dbValue ) {
        fromVal = data.fromIntegerValue.dbValue;
        fromPreview = fromOperator + ' ' + fromVal;
    }
    if( data.freeFormStringValue && data.freeFormStringValue.dbValue ) {
        toPreview = data.freeFormStringValue.dbValue;
        fromPreview = '= ';
    }
    if( data.fromDoubleValue && data.fromDoubleValue.dbValue ) {
        fromVal = data.fromDoubleValue.dbValue;
        fromPreview = fromOperator + ' ' + fromVal;
    }
    if( data.typeOfFamily.dbValue === 'Date' ) {
        if( data.fromDateTime.displayValues && data.fromDateTime.displayValues[ 0 ] !== '' ) {
            fromVal = data.fromDateTime.displayValues[ 0 ].split( ' ' )[ 0 ];
            fromPreview = fromOperator + ' ' + fromVal;
        } else if( data.fromDateTime.uiValue !== '' ) {
            let fromDate = data.fromDateTime.uiValue.split( ' ' )[ 0 ];
            fromVal = fromDate;
            fromPreview = fromOperator + ' ' + fromVal;
        }
    }
    if( data.toOperator ) {
        toOperator = data.toOperator.dbValue;
    }
    if( toOperator !== '--' && ( fromOperator === '>' || fromOperator === '>=' ) ) {
        andOperator = '&';
        if( data.toIntegerValue && data.toIntegerValue.dbValue ) {
            toVal = data.toIntegerValue.dbValue;
            toPreview = ' ' + andOperator + ' ' + toOperator + ' ' + toVal;
        }
        if( data.toDoubleValue && data.toDoubleValue.dbValue ) {
            toVal = data.toDoubleValue.dbValue;
            toPreview = ' ' + andOperator + ' ' + toOperator + ' ' + toVal;
        }
        if( data.typeOfFamily.dbValue === 'Date' ) {
            if( data.toDateTime.displayValues && data.toDateTime.displayValues[ 0 ] !== '' ) {
                toVal = data.toDateTime.displayValues[ 0 ].split( ' ' )[ 0 ];
                toPreview = ' ' + andOperator + ' ' + toOperator + ' ' + toVal;
            } else if( data.toDateTime.uiValue !== '' ) {
                let toDate = data.toDateTime.uiValue.split( ' ' )[ 0 ];
                toVal = toDate;
                toPreview = ' ' + andOperator + ' ' + toOperator + ' ' + toVal;
            }
        }
    }
    dataPreviewUIVal = fromPreview + toPreview;

    let previewObj = { ...data.preview };
    previewObj.dbValue = dataPreviewUIVal;
    previewObj.uiValue = dataPreviewUIVal;

    return {
        previewValue: previewObj,
        fromOperator: data.fromOperator.dbValue
    };
};

/**
 * This method Initialize the properties of view data by using command context
 * @param {Object} viewModel - VM Data
 * @returns {Object} viewModel data
 */
export let initEnumRange = function( viewModel ) {
    let data = { ...viewModel.data };
    let panelCtx = appCtxSvc.getCtx( 'panelContext' );

    // From Grids, update view data based on Grid Selection State
    if( _sourceID === Pca0Constants.GRID_CONSTANTS.VARIANT_CONDITION ) {
        let gridSelectionState = panelCtx.commandContext.gridSelectionState.value;
        data.typeOfFamily.dbValue = gridSelectionState.selectionInfo.type;
        data.nameOfFamily.dbValue = gridSelectionState.selectionInfo.displayName;
        data.isFreeFormFamily.dbValue = gridSelectionState.isFreeFormOptionValueSelected;

        _updateRequireViewDataForGrid( data );
        _initEnumRangeForGridView( data, gridSelectionState );
    }

    // Use old code with CTX update for VCV
    if( _sourceID === 'fscFreeFormRangeExpPanel' ) {
        let cmdCtx = panelCtx.commandContext;
        appCtxSvc.updatePartialCtx( panelCtx.contextKey + '.isFreeFormCtx.commandContext', cmdCtx );
        data.typeOfFamily.dbValue = cmdCtx.family.familyType;
        data.nameOfFamily.dbValue = cmdCtx.family.familyDisplayName;
        data.isFreeFormFamily.dbValue = cmdCtx.family.isFreeForm;

        if( !_.isEmpty( cmdCtx.value ) ) {
            _initializeViewDataFromCmdCtxVCVList( data, cmdCtx );
        }
        _initEnumRangeForVCVList( data, cmdCtx );
    }

    return {
        typeOfFamily: data.typeOfFamily,
        nameOfFamily: data.nameOfFamily,
        isFreeFormFamily: data.isFreeFormFamily,
        fromIntegerValue: data.fromIntegerValue,
        toIntegerValue: data.toIntegerValue,
        fromDoubleValue: data.fromDoubleValue,
        toDoubleValue: data.toDoubleValue,
        fromDateTime: data.fromDateTime,
        toDateTime: data.toDateTime,
        fromOperator: data.fromOperator,
        toOperator: data.toOperator,
        fromChildListValues: data.fromChildListValues,
        toChildListValues: data.toChildListValues,
        enumFromListValues: data.enumFromListValues,
        enumToListValues: data.enumToListValues,
        fromEnumValues: data.fromEnumValues,
        toEnumValues: data.toEnumValues
    };
};

/**
 * Helps to create enumerated range
 * @param {Object} data VM data
 * @returns {Object} enumerated range
 */
export let selectionChangeEnumRange = function( data ) {
    //the from and to lists are always the same, from is always the full list
    let fromVal = '';
    let fromOperator = '';
    let toVal = '';
    let toOperator = '';
    let andOperator = '';
    let toPreview = '';
    let fromPreview = '';
    let dataPreviewUIVal = '';
    let toChildListValues = [];
    let toEnumValues = data.toEnumValues;
    //To Preview Data for Enumerated
    if( data.fromChildListValues && data.fromChildListValues.childValues.length !== 0 ) {
        //To update toListChild Values
        let foundIndex = 0;
        for( const key in data.fromChildListValues.childValues ) {
            // To store values greater than found index
            if( foundIndex ) {
                toChildListValues.push( data.fromChildListValues.childValues[ key ] );
            }
            if( data.fromChildListValues.childValues[ key ].dispValue === data.fromEnumValues.uiValue ) {
                foundIndex = key;
            }
        }

        if( data.toOperator.uiValue === '--' ) {
            toChildListValues = [ {
                dispValue: '--',
                propDisplayValue: '--',
                propDisplayDescription: '',
                propInternalValue: ''
            } ];
            toEnumValues.uiValue = '--';
        } else {
            if( data.typeOfFamily.dbValue === 'Date' &&
                ( data.toEnumValues.uiValue === '--' || Date.parse( new Date( data.toEnumValues.uiValue ) ) <= Date.parse( new Date( data.fromEnumValues.uiValue ) ) ) ) {
                if( toChildListValues.length > 0 ) {
                    toEnumValues.uiValue = toChildListValues[ 0 ].dispValue;
                    toEnumValues.dbValue = toChildListValues[ 0 ].dispValue;
                } else {
                    toEnumValues.uiValue = '--';
                    toEnumValues.dbValue = '--';
                }
            }
            if( ( data.typeOfFamily.dbValue === 'Integer' || data.typeOfFamily.dbValue === 'Floating Point' ) &&
                ( data.toEnumValues.uiValue === '--' || parseFloat( data.toEnumValues.uiValue ) <= parseFloat( data.fromEnumValues.uiValue ) ) ) {
                if( toChildListValues.length > 0 ) {
                    toEnumValues.uiValue = toChildListValues[ 0 ].dispValue;
                    toEnumValues.dbValue = toChildListValues[ 0 ].dispValue;
                } else {
                    toEnumValues.uiValue = '--';
                    toEnumValues.dbValue = '--';
                }
            }
        }

        if( data.fromEnumValues && !_.isUndefined( data.fromEnumValues.uiValue ) ) {
            fromOperator = data.fromOperator.uiValue;
            fromVal = data.fromEnumValues.uiValue;
            fromPreview = fromOperator + ' ' + fromVal;
        }
        if( ( fromOperator === '>' || fromOperator === '>=' ) &&
            ( data.toChildListValues.childValues.length > 0 || toChildListValues.length > 0 ) &&
            data.toOperator.uiValue !== '--' && toEnumValues.uiValue !== '--' ) {
            toOperator = data.toOperator.uiValue;
            andOperator = '&';
            toVal = toEnumValues.uiValue;
            toPreview = ' ' + andOperator + ' ' + toOperator + ' ' + toVal;
        }
        dataPreviewUIVal = fromPreview + toPreview;
    }
    let previewObj = { ...data.preview };
    previewObj.dbValue = dataPreviewUIVal;
    previewObj.uiValue = dataPreviewUIVal;
    return {
        previewValue: previewObj,
        fromOperator: data.fromOperator.dbValue,
        toChildListValues: toChildListValues,
        toEnumValues: toEnumValues
    };
};

export default exports = {
    openAddFreeFormEnumeratedValuePanel,
    initFreeForm,
    loadFamilyInPanel,
    addIntegerValue,
    addStringValue,
    addDoubleValue,
    addDateValue,
    selectionChangeFreeForm,
    initEnumRange,
    selectionChangeEnumRange
};

