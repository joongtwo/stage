// Copyright (c) 2022 Siemens

/**
 * This service file contains methods to cancel/save create operations
 *
 * @module js/AwClsCreateFooterService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import classifySvc from 'js/classifyService';
import classifyUtils from 'js/classifyUtils';
import messagingService from 'js/messagingService';
import Ics1ClassificationTabService from 'js/Ics1ClassificationTabService';
import soaService from 'soa/kernel/soaService';
import ClsEditPropsSvc from 'js/classifyEditPropsService';
import classifyDefinesService from 'js/classifyDefinesService';

var exports = {};

/**
 * Following method process cancel operation if ICO is in edit mode
 * @param {Object} classifyState classify state
 * @returns {Object} classifyState classify state
 */
export let initialize = function( classifyState ) {
    return classifyState.value;
};


/**
 * Following method process cancel operation if ICO is in edit mode
 * @param {*} classifyState classify state
 * @return {*} classifyState classify state
 */
export let processCancel = function( classifyState  ) {
    let tmpState = { ...classifyState.value };
    tmpState.cancelEdits = true;
    tmpState =  Ics1ClassificationTabService.resetClassifyState( tmpState );
    classifyState.update( tmpState );
};


/**
 * Update state to indicate Save is completed
 *
 * @param {Object} context - The context to update to prevent saving.
 */
export let tellContextNotToSaveEdits = function( classifyState, saveSuccess ) {
    let tmpState = { ...classifyState.value };
    if ( tmpState.panelMode === 1 && !tmpState.isClassifyPanel ) {
        ClsEditPropsSvc.removeEditHandler();
    }
    tmpState.shouldSaveEdits = undefined;
    tmpState.shouldSave = undefined;
    tmpState.standaloneExists = false;
    tmpState.standaloneIco = null;
    tmpState.editProperties = false;
    if ( saveSuccess ) {
        tmpState.panelMode = -1;
    }
    classifyState.update( tmpState );
};

/*
 * Compiles the classification properties and their values to be sent in the classify operation.
 *
 * @param {Object} data - the viewmodel data for this panel
 * @returns class properties
 */
export let getClassProperties = function( data, classifyState ) {
    var properties = [];
    //If in edit mode, use selected class.
    //May need to be updated when paste functionality is introduced.
    var selectedClass = classifyState.selectedClass;
    if( classifyState.panelMode === 1 ) {
        selectedClass = classifyState.selectedClass;
    }

    var valuesMap = classifyUtils.getClsUtilValueMap( data, selectedClass.id, null, null, classifyState.attrs );
    if( valuesMap ) {
        properties = valuesMap.properties;
        var isPasteClicked = classifyState.pasteClicked;

        var icoId = null;
        // Classification object id
        if( isPasteClicked ) {
            icoId = '';
        } else {
            icoId = data.ico ? data.ico.uid : '';
        }

        if( classifyState && classifyState.value && classifyState.value.standaloneExists !== true && !classifyState.value.standAlone || !classifyState.standAlone ) {
            properties.push( {
                propertyId: classifySvc.UNCT_ICO_UID,
                propertyName: '',
                values: [ {
                    internalValue: icoId,
                    displayValue: icoId
                } ]
            } );
        }

        if( classifyState && classifyState.value && classifyState.value.standaloneExists && classifyState.value.standaloneExists === true ) {
            properties.push( {
                propertyId: classifySvc.UNCT_ICO_UID,
                propertyName: '',
                values: [ {
                    internalValue: classifyState.value.standaloneIco.clsObject.uid,
                    displayValue: classifyState.value.standaloneIco.clsObject.uid
                } ]
            } );
        }
        // Classification class id
        if( isPasteClicked ) {
            var values = [];
            var propertyValueObj = {
                internalValue: '',
                displayValue: ''
            };
            if( !data.pasteSaved ) {
                propertyValueObj.displayValue = classifyState.targetObject.cellInternalHeader1;
                propertyValueObj.internalValue = classifyState.targetObject.cellInternalHeader1;
                values.push( propertyValueObj );
            } else {
                propertyValueObj.displayValue = data.selectedClass.id;
                propertyValueObj.internalValue = data.selectedClass.id;
                values.push( propertyValueObj );
            }
            properties.push( {
                propertyId: classifySvc.UNCT_CLASS_ID,
                propertyName: '',
                values: values
            } );
        } else {
            properties.push( {
                propertyId: classifySvc.UNCT_CLASS_ID,
                propertyName: '',
                values: [ {
                    internalValue: selectedClass.id,
                    displayValue: selectedClass.id
                } ]
            } );
        }
        // ICO unit system
        var currentUnitSystem = classifyState.currentUnitSystem.dbValue ? '0' : '1';
        properties.push( {
            propertyId: classifySvc.UNCT_CLASS_UNIT_SYSTEM,
            propertyName: '',
            values: [ {
                internalValue: currentUnitSystem,
                displayValue: currentUnitSystem
            } ]
        } );

        // Push a special property to indicate the standalone needs to be connected.
        // Now, if the user has chosen to create a new classification( instead of connecting to existing),
        // then we don't not need to set this property.
        if( classifyState.standaloneExists && classifyState.standaloneExists === true ) {
            properties.push( {
                // Currently using this 'nowhere defined' value for ICS_CONNECT_STANDALONE property.
                // We need a better mechanism than this to send it to SOA though
                propertyId: classifySvc.ICS_CONNECT_STANDALONE,
                propertyName: '',
                values: [ {
                    internalValue: 'true',
                    displayValue: 'true'
                } ]
            } );
        }
    }
    return properties;
};

/*
 * Calls the valuesMap function to create the block data map and return it.
 *
 * @param {Object} data - the viewmodel data for this panel
 * @returns class blocks
 */
export let getClassBlocks = function( data, classifyState ) {
    //In case of edit mode, make sure that selected class is selected correctly.
    //May cause an issue with pasting.
    var selectedClass = classifyState.selectedClass;
    if( classifyState.panelMode === 1 ) {
        selectedClass = classifyState.selectedClass;
    }
    var valuesMap = classifyUtils.getClsUtilValueMap( data, selectedClass.id, null, null, classifyState.attrs );
    if( valuesMap ) {
        return valuesMap.blockProperties;
    }
};


/**
 * Following method is for saveClasification SOA for standalone object creation
 * @param {Object} data Declarative view model
 * @param {Object} clsObject clsObject
 * @param {Object} selectedItem selected item
 * @param {Object} workspaceObject workspace object
 * @param {Object} type type of selected object
 * @param {Object} classifyState classifyState
 * @returns {Object} promise resolved
 */
export let saveClassificationForStandAlone = function( data, clsObject, workspaceObjectUid, selectedItem, type, classifyState ) {
    var tmpClsState = { ...classifyState.value };
    var properties = exports.getClassProperties( data, tmpClsState );
    var blockDataMap = exports.getClassBlocks( data, tmpClsState );
    var classificationObject = {
        clsObject: clsObject,
        properties: properties,
        blockDataMap: blockDataMap,
        workspaceObject: {
            uid: workspaceObjectUid,
            type : type
        }
    };

    // const tmpState = { ...classifyState.value };

    if( tmpClsState.pasteClicked ) {
        tmpClsState.pasteInProgress = false;
        classifyState.update( tmpClsState );
    }

    return soaService.postUnchecked( 'Internal-IcsAw-2018-12-Classification', 'saveClassificationObjects2', {
        classificationObjects: [ classificationObject ]
    } ).then(
        function( response ) {
            // Handle partial errors
            let saveSuccess = true;
            if( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
                var msg = processPartialErrors( data, selectedItem, classifyState, response.ServiceData );
                messagingService.showError( msg );
                saveSuccess = false;
            }
            //reset flags in classifyState
            // tellContextNotToSaveEdits( classifyState, saveSuccess );
            return response;
        } );
};

export let saveClassification = function( data, clsObject, workspaceObjectUid, selectedItem, classifyState ) {
    var tmpClsObject = clsObject ? clsObject : classifySvc.getClsObject( data );
    var tmpClsState = { ...classifyState.value };
    var properties = exports.getClassProperties( data, tmpClsState );
    var blockDataMap = exports.getClassBlocks( data, tmpClsState );
    var classificationObject = {
        clsObject: {
            uid: tmpClsObject.uid
        },
        properties: properties,
        blockDataMap: blockDataMap,
        workspaceObject: {
            uid: workspaceObjectUid
        }
    };

    // const tmpState = { ...classifyState.value };

    if( tmpClsState.pasteClicked ) {
        tmpClsState.pasteInProgress = false;
        classifyState.update( tmpClsState );
    }

    return soaService.postUnchecked( 'Internal-IcsAw-2018-12-Classification', 'saveClassificationObjects2', {
        classificationObjects: [ classificationObject ]
    } ).then(
        function( response ) {
            // Handle partial errors
            let saveSuccess = true;
            if( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
                var msg = processPartialErrors( data, selectedItem, tmpClsState, response.ServiceData );
                messagingService.showError( msg );
                saveSuccess = false;
            }
            //reset flags in classifyState
            tellContextNotToSaveEdits( classifyState, saveSuccess );
            return response;
        } );
};

let getMessageString = function( data, selectedItem, classifyState, messages, msgObj ) {
    var mCtxStr = selectedItem.props.object_string.uiValues[0];
    var selectedClass = null;
    //In case of edit mode, make sure that selected class is selected correctly.
    //May cause an issue with pasting.
    if( classifyState.panelMode === 1 || classifyState.pasteClicked === true ) {
        //in case of paste mode, we should take object from pselected
        if ( classifyState.pasteClicked === true ) {
            if( appCtxSvc.getCtx( 'pselected' ) ) {
                var mCtx = appCtxSvc.getCtx( 'pselected' );
                mCtxStr = mCtx.cellHeader1;
            }
        }

        selectedClass = classifyState.selectedClass.className;
    } else {
        selectedClass = classifyState.selectedNode.displayName;
    }

    // Adding this temp obj to msgObj that will be removed before returning.
    // Doing this so when only get one error message.

    msgObj.errorStore = [];

    _.forEach( messages, function( object ) {
        if( msgObj.msg.length > 0 ) {
            msgObj.msg += '<BR/>';
        }

        var displayMsg = '';
        // Fix for an issue with traditional classification.
        // Both errors code are sent back from the server causing the error to be displayed twice.
        // This ensures that we display the error only once. However, why we just don't send back the error that was handed back from the server is beyond me... I'm guessing something to do with PV.
        if ( ( object.code === classifyDefinesService.SML_ERR_MULTIINST_VIOLATION ||
             object.code === classifyDefinesService.CLS_ERR_MULTIPLE_CLASSIFICATION_NOT_ALLOWED ) &&
             ( !msgObj.errorStore.includes( classifyDefinesService.SML_ERR_MULTIINST_VIOLATION ) &&
             !msgObj.errorStore.includes( classifyDefinesService.CLS_ERR_MULTIPLE_CLASSIFICATION_NOT_ALLOWED ) )
        ) {
            displayMsg = data.i18n.multipleClassificationInSameClass;
            displayMsg = displayMsg.replace( '{0}', mCtxStr );
            displayMsg = displayMsg.replace( '{1}', selectedClass );
            msgObj.errorStore.push( classifyDefinesService.SML_ERR_MULTIINST_VIOLATION );
            msgObj.errorStore.push( classifyDefinesService.CLS_ERR_MULTIPLE_CLASSIFICATION_NOT_ALLOWED );
        }
        if( object.code === classifyDefinesService.SML_ERR_NO_ACCESS ) {
            displayMsg = data.i18n.editObjectAccessPermissionError;
            displayMsg = displayMsg.replace( '{0}', mCtxStr );
        }
        if( object.code === classifyDefinesService.SML_ERR_FORMAT_INCORRECT_DATE ) {
            displayMsg = data.i18n.createOrUpdateFailedError;
            displayMsg = displayMsg.replace( '{0}', mCtxStr );
        }
        if( object.code === classifyDefinesService.SML_ERR_FORMAT_TOO_MANY_DIGITS_LEFT_TO_DECIMAL_POINT ||
            object.code === classifyDefinesService.SML_ERR_ATTRIBUTE_ERR ) {
            displayMsg = object.message;
        }
        if( object.code === classifyDefinesService.SML_ERR_INSTANCE_NOT_UNIQUE ) {
            displayMsg = object.message;
        }
        if( object.code === classifyDefinesService.CLS_ERR_DUPLICATE_STANDALONE_OBJECT ) {
            displayMsg = object.message;
        }

        msgObj.msg += displayMsg;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );

    delete msgObj.errorStore;
};


let processPartialErrors = function( data, selectedItem, classifyState, serviceData ) {
    var msgObj = {
        msg: '',
        level: 0
    };

    if( serviceData.partialErrors ) {
        _.forEach( serviceData.partialErrors, function( partialError ) {
            getMessageString( data, selectedItem, classifyState, partialError.errorValues, msgObj );
        } );
    }

    return msgObj.msg;
};


export default exports = {
    initialize,
    getClassBlocks,
    getClassProperties,
    processCancel,
    saveClassification,
    tellContextNotToSaveEdits,
    saveClassificationForStandAlone
};
