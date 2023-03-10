// Copyright (c) 2022 Siemens

/**
 * This is a utility to format the response of the getAttributes2 classification SOA to be compatible with the generic
 * property widgets.
 *
 * @module js/Ics1ClassificationTabService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import classifySvc from 'js/classifyService';
import classifyUtils from 'js/classifyUtils';
import messagingService from 'js/messagingService';
import soaService from 'soa/kernel/soaService';
import viewModelObjectService from 'js/viewModelObjectService';
import ClsEditPropsSvc from 'js/classifyEditPropsService';
import classifyDefinesService from 'js/classifyDefinesService';

var exports = {};

/**
 * Activate create classify panel
 * @param {Object} classifyState classify state
 * @return {Object} classifyState classify state
 */
let cleanClassifyStateForPanel = function( classifyState ) {
    classifyState = resetClassifyState( classifyState );
    classifyState.showImages = false;
    classifyState.showPropTree = false;
    classifyState.showProperties = true;
    classifyState.isClassifyPanel = true;
    return classifyState;
};

/**
 * Activate create classify panel
 * @param {Object} subPanelContext - subpanel context
 */
export let activateCreatePanel = function( subPanelContext ) {
    let classifyState = subPanelContext.classifyState;
    let tmpState = { ...classifyState.value };
    tmpState = cleanClassifyStateForPanel( tmpState );
    tmpState = setCreateMode( tmpState, subPanelContext.selectionData );
    classifyState.update( tmpState );
};


/**
 * Activate view classify panel
 * @param {Object} subPanelContext - subpanel context
 */
export let activateViewPanel = function( subPanelContext ) {
    let classifyState = subPanelContext.classifyState;
    let tmpState = { ...classifyState.value };
    tmpState = cleanClassifyStateForPanel( tmpState );
    classifyState.update( tmpState );
};

/**
 * This method is used to initialize the classify panel.
 * @param {Object} classifyState - The current state of the classification tab view.
 * @param {Object} classifyStateUpdater - The updater object used to update the tab view state. (Kamu is this correct?)
 */
export let initializeClassifyPanel = ( classifyState, classifyStateUpdater ) => {
    const updateAtomicData = classifyStateUpdater.classifyState;

    let newState = cleanClassifyStateForPanel( classifyState );
    newState.isClassifyPanel = true;
    updateAtomicData( { ...classifyState, ...newState } );
};

/**
 * Handles show/hide Properties command in classify panel
 * @param {Object} commandContext - command context
 */
export let showProperties = function( commandContext ) {
    let classifyState = commandContext.classifyState;
    const tmpState = { ...classifyState.value };
    tmpState.showProperties = !tmpState.showProperties;
    // In classify panel if properties command is selected then other commands
    if( tmpState.isClassifyPanel && tmpState.showProperties === true ) {
        tmpState.showImages = false;
        tmpState.showPropTree = false;
    }
    classifyState.update( tmpState );
};

/**
 * Handles show/hide property group command
 * @param {Object} commandContext - command context
 */
export let showPropGroups = function( commandContext ) {
    let classifyState = commandContext.classifyState;
    const tmpState = { ...classifyState.value };
    tmpState.showPropTree = !tmpState.showPropTree;
    // In classify panel if property groups command is selected then deselect other commands
    if( tmpState.isClassifyPanel && tmpState.showPropTree === true ) {
        tmpState.showProperties = false;
        tmpState.showImages = false;
    }
    classifyState.update( tmpState );
};

/**
 * Handles show/hide Images command
 * @param {Object} commandContext - command context
 */
export let showImages = function( commandContext ) {
    let classifyState = commandContext.classifyState;
    const tmpState = { ...classifyState.value };
    tmpState.showImages = !tmpState.showImages;
    // In classify panel if image command is selected then deselect other commands
    if( tmpState.isClassifyPanel && tmpState.showImages === true ) {
        tmpState.showProperties = false;
        tmpState.showPropTree = false;
    }
    classifyState.update( tmpState );
};

/**
 * Handles show/hide classification section command
 * @param {Object} commandContext - command context
 */
export let showTabTree = function( commandContext ) {
    let classifyState = commandContext.classifyState;
    const tmpState = { ...classifyState.value };
    tmpState.showTabTree = !tmpState.showTabTree;
    classifyState.update( tmpState );
};

/**
 * This method is used to initialize the tab view.
 * @param {Object} classifyState - The current state of the classification tab view.
 * @param {Object} classifyStateUpdater - The updater object used to update the tab view state. (Kamu is this correct?)
 */
export let initializeTab = ( classifyState, classifyStateUpdater ) => {
    var clsTab = appCtxSvc.getCtx( 'clsTab' );
    clsTab = {};
    clsTab.panelMode = -1;
    appCtxSvc.registerCtx( 'clsTab', clsTab );
    const updateAtomicData = classifyStateUpdater.classifyState;
    let newState = resetClassifyState(  );
    updateAtomicData( { ...classifyState, ...newState } );
};

/**
 * Fires the event to navigate to the 'Create' classification sub-panel
 *
 * @param {*} classifyStateValue classify state
 * @param {Object} parentSelectedData - The parent component's subPanelConext's selectionData that will be updated with selectionData.lected object
 * @param {Bool} editClassFlag - Flag to determine if we are being called from the the edit class use case.
 * @return {*} classifyState classify state
 */
export let setCreateMode = function( classifyStateValue, parentSelectedData, editClassFlag ) {
    const newValue = { ...classifyStateValue };
    newValue.panelMode = 0;

    if( classifyStateValue.selectedClass && !classifyStateValue.standaloneExists ) {
        editClassFlag = true;
        newValue.editClassUID = classifyStateValue.selectedClass.uid;
        newValue.expandToClass = classifyStateValue.selectedClass.id;
        newValue.editClassCmd = {
            targetClassID: classifyStateValue.selectedClass.id,
            alreadySelectedClassNode: false,
            alreadyShownEditClassAttr: false
        };
    }

    if( !editClassFlag ) {
        newValue.attrs = [];
        newValue.numOfAttrs = 0;
        newValue.hasBlocks = false;
        newValue.hasImages = false;
    }

    if( parentSelectedData ) {
        cleanUpSelectionData( parentSelectedData );
    }

    return newValue;
};

/**
 * Resets classify state
 * @param {*} classifyState classify state
 * @return {*} classifyState classify state
 */
export let resetClassifyState = function( classifyState ) {
    classifyState = classifyState ?? {};
    classifyState.panelMode = -1;
    classifyState.editProperties = false;
    classifyState.attrs = [];
    classifyState.numOfAttrs = 0;
    classifyState.selectedNode = null;
    classifyState.editClassUID = classifyDefinesService.NULL_UID;
    classifyState.editClassCmd = {};
    classifyState.pasteComplete = classifyState.pasteClicked === true;
    classifyState.pasteClicked = false;
    classifyState.pasteInProgress = false;
    classifyState.shouldSaveEdits = false;
    classifyState.updateInstances = null;
    if ( classifyState.selectedCardinalAttribute ) {
        classifyState.selectedCardinalAttribute = undefined;
    }
    if ( classifyState.selectedPropertyGroup ) {
        classifyState.selectedPropertyGroup = undefined;
    }
    classifyState.hasBlocks = false;

    return classifyState;
};

/**
 * Fires the event to navigate to the 'Create' classification sub-panel
 *
 * @param {*} classifyState classify state
 * @return {*} classifyState classify state
 */
export let resetCreateMode = function( classifyState  ) {
    let tmpState = { ...classifyState.value };
    tmpState = resetClassifyState( tmpState );
    classifyState.update( tmpState );
};

/**
 * Following method process cancel operation if ICO is in edit mode
 * @param {*} classifyState classify state
 * @return {*} classifyState classify state
 */
export let processCancel = function( classifyState  ) {
    classifyState.cancelEdits = true;
    return resetClassifyState( classifyState );
};

/*
 * Compiles the classification properties and their values to be sent in the classify operation.
 *
 * @param {Object} data - the viewmodel data for this panel
 * @returns class properties
 */
export let getClassProperties = function( data, classifyState ) {
    var properties = [];
    if( !data.classifyState ) {
        data.classifyState = classifyState;
    }
    //If in edit mode, use selected class.
    //May need to be updated when paste functionality is introduced.
    var selectedClass = data.classifyState.selectedClass;
    if( data.classifyState.panelMode === 1 ) {
        selectedClass = data.classifyState.selectedClass;
    }

    var valuesMap = classifyUtils.getClsUtilValueMap( data, selectedClass.id, null, null, data.classifyState.attrs );
    if( valuesMap ) {
        properties = valuesMap.properties;
        var isPasteClicked = classifyState.value ? classifyState.value.pasteClicked : classifyState.pasteClicked;

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
        var currentUnitSystem = data.classifyState.currentUnitSystem.dbValue || data.classifyState.currentUnitSystem.value ? '0' : '1';
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
        var ctx = appCtxSvc.getCtx( 'classifyTableView' );
        if( ctx && ctx.attribute && ctx.attribute.tableView ) {
            ctx.noReload = true;
            appCtxSvc.updateCtx( 'classifyTableView', ctx );
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
export let getClassBlocks = function( data ) {
    //In case of edit mode, make sure that selected class is selected correctly.
    //May cause an issue with pasting.
    var selectedClass = data.classifyState.selectedClass;
    if( data.classifyState.panelMode === 1 ) {
        selectedClass = data.classifyState.selectedClass;
    }
    var valuesMap = classifyUtils.getClsUtilValueMap( data, selectedClass.id, null, null, data.classifyState.attrs );
    if( valuesMap ) {
        return valuesMap.blockProperties;
    }
};

/**
 * To get classified workspace object id
 * @param {Object} response the declarative viewmodel data
 * @param {Object} subPanelConext sub-panel context
 * @returns {String} uid - uid
 */
export let getClassifiedWorkspaceObjectID = function( response, subPanelContext ) {
    var uid = '';
    if( response.classificationObjects && response.classificationObjects.length > 0 ) {
        //stand alone object. Save to be used in MRU
        var standAloneObject = response.classificationObjects[ 0 ].clsObject;
        uid = standAloneObject.uid;
        var vmo = viewModelObjectService.createViewModelObject( uid );
        vmo.classId = classifySvc.getPropertyValue( response.classificationObjects[ 0 ].properties, classifySvc.UNCT_CLASS_ID );
        const tmpContext = { ...subPanelContext.context.searchState.value };
        if( !tmpContext.standAloneObjects ) {
            tmpContext.standAloneObjects = [];
        }
        tmpContext.standAloneObjects.push( vmo );
        tmpContext.isRecent = true;
        subPanelContext.context.searchState.update( tmpContext );
    }
    return uid;
};


/**
 * Update state to indicate Save is completed
 *
 * @param {Object} context - The context to update to prevent saving.
 */
export let tellContextNotToSaveEdits = function( context, saveSuccess ) {
    ClsEditPropsSvc.removeEditHandler();
    context.shouldSaveEdits = undefined;
    context.shouldSave = undefined;
    context.standaloneExists = false;
    context.standaloneIco = null;
    if ( saveSuccess ) {
        context.panelMode = -1;
    }
};


/**
 * Following method is for saveClasification SOA for standalone object creation
 * @param {Object} data Declarative view model
 * @param {Object} clsObject clsObject
 * @param {Object} workspaceObject workspace object
 * @param {Object} type type of selected object
 * @param {Object} classifyState classifyState
 * @returns {Object} promise resolved
 */
export let saveClassificationForStandAlone = function( data, clsObject,  workspaceObject, type, classifyState ) {
    var properties = exports.getClassProperties( data, classifyState );
    var blockDataMap = exports.getClassBlocks( data );
    var tmpWorkspaceObject = workspaceObject ? workspaceObject : '';
    var classificationObject = {
        clsObject: clsObject,
        properties: properties,
        blockDataMap: blockDataMap,
        workspaceObject: {
            uid: tmpWorkspaceObject,
            type : type
        }
    };

    const tmpState = { ...classifyState.value };

    if( tmpState.pasteClicked ) {
        tmpState.pasteInProgress = false;
        classifyState.update( tmpState );
    }

    return soaService.postUnchecked( 'Internal-IcsAw-2018-12-Classification', 'saveClassificationObjects2', {
        classificationObjects: [ classificationObject ]
    } ).then(
        function( response ) {
            // Handle partial errors
            let saveSuccess = true;
            if( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
                var msg = processPartialErrors( data, response.ServiceData );
                messagingService.showError( msg );
                saveSuccess = false;
            }
            //reset flags in classifyState
            tellContextNotToSaveEdits( classifyState, saveSuccess );
            return response;
        } );
};

export let saveClassification = function( data, clsObject, workspaceObject, classifyState ) {
    var tmpClsObject = clsObject ? clsObject : classifySvc.getClsObject( data );
    var properties = exports.getClassProperties( data, classifyState );
    var blockDataMap = exports.getClassBlocks( data );
    var tmpWorkspaceObject = workspaceObject ? workspaceObject : '';
    var classificationObject = {
        clsObject: {
            uid: tmpClsObject.uid
        },
        properties: properties,
        blockDataMap: blockDataMap,
        workspaceObject: {
            uid: tmpWorkspaceObject
        }
    };

    const tmpState = { ...classifyState.value };

    if( tmpState.pasteClicked ) {
        tmpState.pasteInProgress = false;
        classifyState.update( tmpState );
    }

    return soaService.postUnchecked( 'Internal-IcsAw-2018-12-Classification', 'saveClassificationObjects2', {
        classificationObjects: [ classificationObject ]
    } ).then(
        function( response ) {
            // Handle partial errors
            let saveSuccess = true;
            if( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
                var msg = processPartialErrors( data, response.ServiceData );
                messagingService.showError( msg );
                saveSuccess = false;
            }
            //reset flags in classifyState
            tellContextNotToSaveEdits( classifyState, saveSuccess );
            return response;
        } );
};

let getMessageString = function( data, messages, msgObj ) {
    var mCtx = appCtxSvc.getCtx( 'pselected' );
    var mCtxStr = mCtx ? mCtx.cellHeader1 : null;
    var selectedClass = null;
    //In case of edit mode, make sure that selected class is selected correctly.
    //May cause an issue with pasting.
    if( data.classifyState.panelMode === 1 || data.classifyState.pasteClicked === true ) {
        //in case of paste mode, we should take object from pselected
        if( data.classifyState.pasteClicked === true ) {
            if( appCtxSvc.getCtx( 'pselected' ) ) {
                mCtx = appCtxSvc.getCtx( 'pselected' );
                mCtxStr = mCtx.cellHeader1;
            }
        }

        selectedClass = data.classifyState.selectedClass.className;
    } else {
        selectedClass = data.classifyState.selectedNode.displayName;
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

/**
 * Builds crumbs
 * @param {Object} classifyState classify State
 * @param {Object} data Declarative view model
 * @returns {Object} newValue
 */
export let getCrumbsForPastedIco = function( classifyState, data ) {
    var targetObject;
    var path;
    if( classifyState && classifyState.value && classifyState.value.standaloneIco ) {
        targetObject = classifyState.value.standaloneIco;
        var classId = classifySvc.getPropertyValue( targetObject.properties, classifySvc.UNCT_CLASS_ID );
        // Also store parentIds to be used in case of edit class. We need to expand the hierarchy upto the classified class while reclassifying.
        var parentIds = [];
        var parents = classifySvc.getParentsPath( classifyState.value.classParents[ classId ].parents, parentIds );

        path = {
            value: parents.join( ' > ' ) + ' > ',
            value1: data.standaloneIco.clsObject.modelType.displayName
        };
    } else{
        targetObject = classifyState.value.targetObject;
        var cellExtendedTooltipProps = targetObject.cellExtendedTooltipProps;
        path = cellExtendedTooltipProps[ 3 ];
    }

    let newValue = { ...data.descriptionString };
    newValue.uiValue = path.value + path.value1;
    return newValue;
};

let processPartialErrors = function( data, serviceData ) {
    var msgObj = {
        msg: '',
        level: 0
    };

    if( serviceData.partialErrors ) {
        _.forEach( serviceData.partialErrors, function( partialError ) {
            getMessageString( data, partialError.errorValues, msgObj );
        } );
    }

    return msgObj.msg;
};

/** This method is used to update the parent components selectionData.
 * @param {Object} selectionData - The newly selected selection data that will be used to update the parent component.
 * @param {Object} parentSelectedData - The parent component's subPanelConext's selectionData that will be updated with selectionData.
 */
export let handleSelectionChange = function( selectionData, parentSelectedData ) {
    if( selectionData && parentSelectedData ) {
        parentSelectedData.update( {
            selectionModel: selectionData.selectionModel,
            selected: selectionData.selected ? selectionData.selected : []
        } );
    }
};

/**
 * This method is used to clear the selectionData when the classification tab view is unmounts.
 * @param {Object} parentSelectedData - The parent component's subPanelConext's selectionData that will be updated with selectionData.
 */
export let cleanUpSelectionData = function( parentSelectedData ) {
    parentSelectedData.update( {
        selected: []
    } );
};


/**
 * This method is used to return the work space object uid from the subPanelContext.
 * @param {Object} subPanelContext - The parent component's subPanelConext's selectionData that will be updated with selectionData.
 * @param {Object} mselected - the selected object.
 * @param {Object} fromAPanel - The parent component's subPanelConext's selectionData that will be updated with selectionData.
 * @return {String} The work space object Uid.
 */
export let addWorkspaceObjectUidtoData = function( subPanelContext, mselected, fromAPanel ) {
    let selected = subPanelContext ? subPanelContext.selected : null;
    let uid = selected ? selected.uid : '';
    if ( uid === '' ) {
        if( subPanelContext && subPanelContext.selectionData && subPanelContext.selectionData.selected ) {
            selected = subPanelContext.selectionData.selected && subPanelContext.selectionData.selected.length > 0 ? subPanelContext.selectionData.selected[0] : null;
            uid = selected  ? selected.uid : '';
        }

        //if uid is still empty, set from mselected
        if  ( ( fromAPanel || uid === '' ) && mselected && mselected.length > 0 ) {
            uid = mselected[ 0 ].uid;
            selected = mselected[0];
        }
    }

    var locationContext = appCtxSvc.getCtx( 'locationContext' );

    if( !fromAPanel && locationContext !== undefined &&  ( locationContext['ActiveWorkspace:SubLocation'] === 'com.siemens.splm.client.occmgmt:OccurrenceManagementSubLocation' ||
        locationContext['ActiveWorkspace:SubLocation'] === 'PartManufacturing' ) ) {
        selected = subPanelContext.selected ? subPanelContext.selected : null;
        let props = selected && selected.props ? selected.props : null;
        let awb0UnderlyingObject = props && props.awb0UnderlyingObject && props.awb0UnderlyingObject.dbValues['0'] ? props.awb0UnderlyingObject.dbValues['0'] : null;
        uid = awb0UnderlyingObject;
    }

    return {
        uid: uid,
        selectedItem: selected
    };
};

export let updateResponseState = function( response, responseState ) {
    let tmpResponseState = { ...responseState.value };
    tmpResponseState.response = response;
    responseState.update( tmpResponseState );
};

export let editClassCommandHandler = ( commandContext ) => {
    let newClassifyStateValues = setCreateMode( commandContext.itemOptions.value, null, true );
    newClassifyStateValues.editClassUID = commandContext.vmo.uid;
    newClassifyStateValues.expandToClass = commandContext.vmo.props.CLASS_ID.value;
    newClassifyStateValues.editClassCmd = {
        targetClassID: commandContext.vmo.props.CLASS_ID.value,
        // parentClasses: commandContext.itemOptions.value.classParents, // We might be able to remove an SOA for edit class
        alreadySelectedClassNode: false,
        alreadyShownEditClassAttr: false,
        clsObject: {
            uid: commandContext.vmo.uid,
            type: commandContext.vmo.type
        }
    };
    commandContext.itemOptions.update( newClassifyStateValues );
};


export default exports = {
    activateCreatePanel,
    activateViewPanel,
    addWorkspaceObjectUidtoData,
    cleanUpSelectionData,
    editClassCommandHandler,
    getClassBlocks,
    getClassProperties,
    getClassifiedWorkspaceObjectID,
    getCrumbsForPastedIco,
    handleSelectionChange,
    initializeClassifyPanel,
    initializeTab,
    processCancel,
    resetClassifyState,
    resetCreateMode,
    saveClassification,
    setCreateMode,
    showImages,
    showProperties,
    showPropGroups,
    showTabTree,
    tellContextNotToSaveEdits,
    updateResponseState,
    saveClassificationForStandAlone
};
