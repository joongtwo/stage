// Copyright (c) 2022 Siemens

/**
 * @module js/occMgmtDuplicateActionService
 */
import appCtxSvc from 'js/appCtxService';
import editHandlerService from 'js/editHandlerService';
import dataManagementSvc from 'soa/dataManagementService';
import LocationNavigationService from 'js/locationNavigation.service';
import cdm from 'soa/kernel/clientDataModel';
import localeService from 'js/localeService';
import occmgmtUtils from 'js/occmgmtUtils';
import eventBus from 'js/eventBus';
import _ from 'lodash';

let exports = {};

/** Duplicate Info */
let _duplicateInfo = {};

/** Valid Duplicate Operation container*/
let _validDuplicateOperations = null;

/** Localized value for Pending string*/
let _localizedPendingString = null;

let OCCIDENTIFIERPROPERTY = 'awb0UnderlyingObject';

let contextKey = 'occmgmtContext';

let _occDataLoadedEventListener = null;

let panelSettings = {
    autogen: true,
    fromString: '',
    toString: '',
    prefix: '',
    suffix: ''
};

const operationTypes = {
    CLONE: 0, // 0 indicates clone operation
    REFERENCE: 1, // 1 indicates Reference operation
    REVISE: 2, // 2 indicates Revise operation
    REPLACE: 3, // 3 indicates Replace operation
    IGNORE: 5, // 5 indicates Ignore operation
    CLONE_BELOW: 6 // 6 indicates Clone Below operation
};
const _cloneContentData = {};
const AWB0ARCHETYPEID = 'awb0ArchetypeId';
const AWB0ARCHETYPEREVID = 'awb0ArchetypeRevId';
const AWB0ARCHETYPEREVNAME = 'awb0ArchetypeRevName';
const AWB0ARCHETYPEREVDESC = 'awb0ArchetypeRevDescription';

/**
 * Initializes Duplicate service.
 */
export let initialize = function( contextkey ) {
    contextKey = contextkey;
    clearDuplicateInfo();

    // Subscribe to occDataLoadedEvent event to to set OCCIDENTIFIERPROPERTY based on Awb0IsOccurrenceCloneDataEnabled
    if( !_occDataLoadedEventListener ) {
        _occDataLoadedEventListener = eventBus.subscribe( 'occDataLoadedEvent', function() {
            if( appCtxSvc.ctx[ contextKey ].supportedFeatures.Awb0IsOccurrenceCloneDataEnabled ) {
                OCCIDENTIFIERPROPERTY = 'awb0CopyStableId';
            }
            eventBus.unsubscribe( _occDataLoadedEventListener );
            _occDataLoadedEventListener = null;
        } );
    }

    let resource = 'OccMgmtDuplicateConstants';
    let localeTextBundle = localeService.getLoadedText( resource );

    // Initialize duplicate actions container for localization
    _validDuplicateOperations = {
        0: localeTextBundle.occMgmtDuplicateClone, // 0 indicates clone operation
        1: '', // 1 indicates Reference operation, Default doesn't need any visual indication
        3: localeTextBundle.occMgmtDuplicateReplace, // 3 indicates Replace operation
        5: localeTextBundle.occMgmtDuplicateRemove, // 5 indicates Ignore operation
        6: localeTextBundle.occMgmtDuplicateCloneBelow // 6 indicates CloneBelow operation
    };
    _localizedPendingString = localeTextBundle.occMgmtDuplicatePendingText;

    occmgmtUtils.setDecoratorToggle( true, true );

    updateContextForCloneContentSaveSpecification();
};

let updateContextForCloneContentSaveSpecification = function() {
    let addInWorkingCtxData = appCtxSvc.getCtx( 'addInWorkingCtxData' );
    if( addInWorkingCtxData ) {
        let cloneContentSaveSpecifications = {
            removeOnRead: true,
            data: _cloneContentData
        };
        appCtxSvc.updatePartialCtx( 'addInWorkingCtxData.cloneContentSaveSpecifications', cloneContentSaveSpecifications );
        appCtxSvc.updatePartialCtx( 'addInWorkingCtxData.requestPref.deleteCloneData', [ 'false' ] );
    } else {
        addInWorkingCtxData = {
            cloneContentSaveSpecifications: {
                removeOnRead: true,
                data: _cloneContentData
            },
            requestPref: { deleteCloneData: [ 'false' ] }
        };
        appCtxSvc.updatePartialCtx( 'addInWorkingCtxData', addInWorkingCtxData );
    }
};

export let deleteCloneOptionsFromBWC = function() {
    let addInWorkingCtxData = appCtxSvc.getCtx( 'addInWorkingCtxData' );
    if( addInWorkingCtxData ) {
        appCtxSvc.updatePartialCtx( 'addInWorkingCtxData.requestPref.deleteCloneData', [ 'true' ] );
        appCtxSvc.updatePartialCtx( 'addInWorkingCtxData.cloneContentSaveSpecifications', null );
    } else {
        addInWorkingCtxData = {
            requestPref: {
                deleteCloneData: [ 'true' ]
            }
        };
        appCtxSvc.updatePartialCtx( 'addInWorkingCtxData', addInWorkingCtxData );
    }
    eventBus.publish( 'StartSaveAutoBookmarkEvent' );
};
/**
 *Reset actions on lines
 */
export let resetDuplicateActions = function( contextKey ) {
    if( appCtxSvc.ctx[ contextKey ] ) {
        // Close Apply markups panel
        let eventData = { source: 'toolAndInfoPanel' };
        eventBus.publish( 'complete', eventData );
        clearDuplicateInfo();

        let editService = editHandlerService.getEditHandler( appCtxSvc.ctx[ contextKey ].vmc.name );
        if( editService && editService._editing ) {
            editService.cancelEdits();
        }

        occmgmtUtils.setDecoratorToggle( false, true );

        if( appCtxSvc.ctx[ contextKey ].vmc ) {
            let topUID = appCtxSvc.ctx[ contextKey ].topElement.uid;
            let loadedVMOs = appCtxSvc.ctx[ contextKey ].vmc.getLoadedViewModelObjects();
            loadedVMOs.filter( function( vmo ) {
                //TODO : probable data mutation case
                if( topUID !== vmo.uid ) {
                    vmo.isDeleted = false;
                    vmo.isGreyedOutElement = false;
                    resetPropOfVMO( vmo, AWB0ARCHETYPEID );
                    resetPropOfVMO( vmo, AWB0ARCHETYPEREVID );
                    resetPropOfVMO( vmo, AWB0ARCHETYPEREVNAME );
                    resetPropOfVMO( vmo, AWB0ARCHETYPEREVDESC );
                    updateUiAndEffectiveValueOfVMO( vmo, '', 1 );
                    delete vmo.__expandState;
                }
            } );
        }
        // Event to update Tree Table UI
        eventBus.publish( 'reRenderTableOnClient' );
    }
};
/**
 * Locate the uid of created/selectd model object. *
 * @returns {String} uid of created/selected model object.
 */
let getElementToReplace = function( createdObject, sourceObjects ) {
    let result = [];
    if( createdObject ) {
        if( Array.isArray( createdObject ) ) {
            result = createdObject;
        } else {
            // check if created a new object ? if yes, create an array, insert this newly created element in it and return
            let objects = [];
            objects.push( createdObject );
            result = objects;
        }
    } else if( sourceObjects ) {
        // return all selected element from palette and search tabs
        result = sourceObjects;
    }

    if( result && result.length === 1 ) {
        let replacedObject = result[ 0 ];
        if( replacedObject.modelType ) {
            if( replacedObject.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
                return replacedObject.uid;
            } else if( replacedObject.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
                if( replacedObject.props && replacedObject.props.awb0UnderlyingObject && replacedObject.props.awb0UnderlyingObject.dbValue ) {
                    return replacedObject.props.awb0UnderlyingObject.dbValue;
                }
            }
        }
    }
};

/**
 *Reset actions on lines and delete actions from bookmark
 */
export let cancelDuplicateModeAndClearData = function() {
    exports.resetDuplicateActions( contextKey );
    exports.deleteCloneOptionsFromBWC();
};
/**
 * Add Action to the Pending Action Column. It also stores clone information and their operation type for the respective occurrence.
 * It propagates operation type up and down to the hierarchy available in tree.
 *
 * @param {Int} operationType - duplicate operation type.
 * @param {DeclViewModel} [data] - The data for the Replace panel.
 */
export let setDuplicateActionOnLine = function( operationType, occContext, createdObject, sourceObjects ) {
    let loadedVMOs = occContext.vmc.getLoadedViewModelObjects();
    let selectedVMO = getSelectedAndConfiguredVMOsWithOutRoot( loadedVMOs );
    let topUID = appCtxSvc.ctx[ contextKey ].topElement.uid;
    for( let j = 0, len = selectedVMO.length; j < len; ++j ) {
        let clonedObjectInfo = {};
        if( operationType === operationTypes.REPLACE ) {
            let replacedObjectUID = getElementToReplace( createdObject, sourceObjects );
            clonedObjectInfo = { itemRev_uid: replacedObjectUID };
        }
        // Store this to local variable
        mergeOrStoreData( selectedVMO[ j ], operationType, clonedObjectInfo );
        let operationTypeVMO = getEffectiveDuplicateOperation( selectedVMO[ j ] );
        if( operationTypeVMO !== operationType ) {
            let vmos = getAllOccurrencesBasedOnIdentifier( loadedVMOs, selectedVMO[ j ], operationType, clonedObjectInfo );
            if( vmos.length > 0 ) {
                for( let i = 0, length = vmos.length; i < length; ++i ) {
                    let isSelected = selectedVMO.find( function( selectedObject ) {
                        return selectedObject.uid === vmos[ i ].uid;
                    } );

                    if( isSelected || isParentBeingCloned( loadedVMOs, vmos[ i ] ) ) {
                        // Update the Column Value to the selected Action
                        updateVMOBasedOnAction( vmos[ i ], operationType, clonedObjectInfo );

                        let cloneOperationTypeForParent = findCloneOperationTypeToPropagateToParent( loadedVMOs, vmos[ i ] );
                        propagatePendingActionToParents( loadedVMOs, selectedVMO, vmos[ i ], topUID, cloneOperationTypeForParent, clonedObjectInfo, true );
                        //Clear Processing information
                        loadedVMOs.forEach( function( vmo ) { delete vmo.isProcessed; } );

                        if( operationTypes.REFERENCE === operationType || operationTypes.IGNORE === operationType ) {
                            propagatePendingActionToChildren( loadedVMOs, vmos[ i ], topUID, operationType, clonedObjectInfo );
                        } else if( operationType === operationTypes.CLONE ) {
                            displayActualPendingActionOnChildren( vmos[ i ], operationType );
                        } else if( operationType === operationTypes.CLONE_BELOW ) {
                            propagatePendingActionToChildrenForCloneBelow( loadedVMOs, vmos[ i ], topUID );
                        } else if( operationType === operationTypes.REPLACE ) {
                            propagateReplaceActionToChildren( vmos[ i ], topUID, operationType );
                        }
                        //Clear Processing information
                        loadedVMOs.forEach( function( vmo ) { delete vmo.isProcessed; } );
                    }
                }
            }
        }
    }
    // Close toolAndInfoPanel panel after operation completed
    let eventData = { source: 'toolAndInfoPanel' };
    eventBus.publish( 'complete', eventData );
    // Event to update Tree Table UI
    eventBus.publish( 'reRenderTableOnClient' );
};

let findCloneOperationTypeToPropagateToParent = function( loadedVMOs, vmo ) {
    let parentVMO = getParentVMO( loadedVMOs, vmo );
    let cloneOperationType = operationTypes.CLONE;
    if( parentVMO ) {
        let cloneInfo = getActualOperationTypeForVMO( parentVMO, false );
        cloneOperationType = cloneInfo.cloneOperationType;
        if( cloneOperationType === operationTypes.CLONE || cloneOperationType === operationTypes.CLONE_BELOW ) {
            return cloneOperationType;
        }
        cloneOperationType = findCloneOperationTypeToPropagateToParent( loadedVMOs, parentVMO );
    }
    return cloneOperationType;
};

let displayActualPendingActionOnChildren = function( vmo, cloneOperationTypeParent ) {
    let children = occmgmtUtils.getImmediateChildrenOfGivenParentNode( vmo );
    // Update children if top
    if( children ) {
        for( let i = 0, len = children.length; i < len; i++ ) {
            if( children[ i ].props && !children[ i ].isProcessed ) {
                let cloneOperationType = 1;
                let clonedObjectInfo = {};
                let cloneInfo;
                if( cloneOperationTypeParent === operationTypes.CLONE && children[ i ].props ) {
                    cloneInfo = getActualOperationTypeForVMO( children[ i ], true );
                    cloneOperationType = cloneInfo.cloneOperationType;
                    clonedObjectInfo = cloneInfo.clonedObjectInfo;
                } else if( cloneOperationTypeParent === operationTypes.CLONE_BELOW ) {
                    cloneInfo = getActualOperationTypeForVMO( children[ i ], false );
                    clonedObjectInfo = cloneInfo.clonedObjectInfo;
                    cloneOperationType = cloneInfo.cloneOperationType;
                    if( cloneInfo.cloneOperationType === null ) {
                        cloneOperationType = cloneOperationTypeParent;
                    }
                } else {
                    cloneOperationType = cloneOperationTypeParent;
                }
                children[ i ].isProcessed = true;
                // Update the Column Value to the selected Action
                updateVMOBasedOnAction( children[ i ], cloneOperationType, clonedObjectInfo );
                // Recursively updates other children till leaf nodes
                displayActualPendingActionOnChildren( children[ i ], cloneOperationType );
            }
        }
    }
};

let getSelectedAndConfiguredVMOsWithOutRoot = function( loadedVMOs ) {
    let selectedVMO = [];
    let topUID = appCtxSvc.ctx[ contextKey ].topElement.uid;
    if( loadedVMOs ) {
        let selectedObj = appCtxSvc.ctx.mselected;
        for( let i = 0; i < selectedObj.length; ++i ) {
            if( selectedObj[ i ].uid !== topUID && !selectedObj[ i ].props.hideDuplicateCommand &&
                selectedObj[ i ].props.awb0ArchetypeRevId && selectedObj[ i ].props.awb0ArchetypeRevId.dbValues[ 0 ].length > 0 ) {
                for( let iDx = 0; iDx < loadedVMOs.length; ++iDx ) {
                    if( loadedVMOs[ iDx ].uid === selectedObj[ i ].uid ) {
                        selectedVMO.push( loadedVMOs[ iDx ] );
                        break;
                    }
                }
            }
        }
    }
    return selectedVMO;
};
/**
 * Return parent vmo based on UID.
 *
 * @param {Object} loadedVMOs -Loaded vmos.
 * @param {Object} vmo - vmo whose parent needs to return.
 * @return {Object} vmo - return vmo based on uid.
 */
let getParentVMO = function( loadedVMOs, vmo ) {
    let parentUID = null;
    if( vmo.props && vmo.props.awb0Parent ) {
        parentUID = vmo.props.awb0Parent.dbValue;
    }
    if( loadedVMOs && parentUID !== null ) {
        for( let iDx = 0; iDx < loadedVMOs.length; ++iDx ) {
            if( loadedVMOs[ iDx ].uid === parentUID ) {
                return loadedVMOs[ iDx ];
            }
        }
    }
};

/**
 * Return All vmos based on UID.
 *
 * @param {Object} loadedVMOs -Loaded vmos.
 * @param {Object} vmo - vmo of underlying Object.
 * @return {Object} vmo - return vmo based on uid.
 */
let getAllOccurrencesBasedOnIdentifier = function( loadedVMOs, vmo, operationType, clonedObjectInfo ) {
    let isCloneOrCloneBelow = Boolean( operationType === operationTypes.CLONE || operationType === operationTypes.CLONE_BELOW );
    let identifier = OCCIDENTIFIERPROPERTY;
    if( isCloneOrCloneBelow && appCtxSvc.ctx[ contextKey ].supportedFeatures.Awb0IsOccurrenceCloneDataEnabled ) {
        identifier = 'awb0UnderlyingObject';
    }
    let allVMOsWithSameID = [];
    allVMOsWithSameID.push( vmo );
    let underlyingObj = null;
    if( vmo.props && vmo.props[ identifier ] && vmo.props[ identifier ].dbValue ) {
        underlyingObj = vmo.props[ identifier ].dbValue;
    }
    if( loadedVMOs && underlyingObj !== null ) {
        for( let iDx = 0; iDx < loadedVMOs.length; ++iDx ) {
            if( loadedVMOs[ iDx ].props && loadedVMOs[ iDx ].props[ identifier ] && loadedVMOs[ iDx ].props[ identifier ].dbValue === underlyingObj ) {
                if( appCtxSvc.ctx[ contextKey ].supportedFeatures.Awb0IsOccurrenceCloneDataEnabled ) {
                    let operationTypeVMO = getEffectiveDuplicateOperation( loadedVMOs[ iDx ] );
                    if( operationTypeVMO === operationTypes.CLONE || operationTypeVMO === operationTypes.CLONE_BELOW ) {
                        if( operationType !== undefined ) {
                            mergeOrStoreData( loadedVMOs[ iDx ], operationType, clonedObjectInfo );
                            updateVMOBasedOnAction( loadedVMOs[ iDx ], operationType, clonedObjectInfo );
                        }
                        allVMOsWithSameID.push( loadedVMOs[ iDx ] );
                    }
                } else {
                    allVMOsWithSameID.push( loadedVMOs[ iDx ] );
                }
            }
        }
    }
    return allVMOsWithSameID;
};

/**
 * Update children of vmo based on duplicate operation downward.
 * @param {Object} loadedVMOs -Loaded vmos.
 * @param {Object} vmo -selected vmo.
 * @param {String} topUID -top node UID.
 * @param {Int} cloneOperationType - duplicate operation type.
 * @param {Object} clonedObjectInfo - info object related to revise and replace.
 */
let propagatePendingActionToChildren = function( loadedVMOs, vmo, topUID, cloneOperationType, clonedObjectInfo ) {
    let children = occmgmtUtils.getImmediateChildrenOfGivenParentNode( vmo );
    // Update children if top
    if( children && topUID !== vmo.uid ) {
        for( let i = 0, len = children.length; i < len; i++ ) {
            //Update Children as well in case of occurrence Level validation
            // if( appCtxSvc.ctx[contextKey].supportedFeatures.Awb0IsOccurrenceCloneDataEnabled ) {
            //     mergeOrStoreData( children[ i ], cloneOperationType, clonedObjectInfo );
            // }
            // Update the Column Value to the selected Action
            updateVMOBasedOnAction( children[ i ], cloneOperationType, clonedObjectInfo );
            // Recursively updates other children till leaf nodes
            propagatePendingActionToChildren( loadedVMOs, children[ i ], topUID, cloneOperationType, clonedObjectInfo );
        }
    }
};
/**
 * Update children of vmo based on duplicate operation downward.
 *
 * @param {Object} vmo - view model object.
 * @param {String} [topUID] - Uid of top node
 * @param {Int} cloneOperationType - operation type that needs to applied.
 */
let propagateReplaceActionToChildren = function( vmo, topUID, cloneOperationType ) {
    let children = occmgmtUtils.getImmediateChildrenOfGivenParentNode( vmo );
    // Update children if top
    if( children && topUID !== vmo.uid ) {
        for( let i = 0, len = children.length; i < len; i++ ) {
            updateVMOBasedOnAction( children[ i ], cloneOperationType, {} );
            propagateReplaceActionToChildren( children[ i ], topUID, cloneOperationType );
        }
    }
};

let isElementUnconfigured = function( vmo ) {
    if( vmo.props.awb0ArchetypeRevId && vmo.props.awb0ArchetypeRevId.dbValues[ 0 ].length === 0 ) {
        return true;
    }
    return false;
};
/**
 * Update children of vmo based on CloneBelow operation downward.
 * @param {Object} loadedVMOs -Loaded vmos.
 * @param {Object} vmo -selected vmo.
 * @param {Object} topUID -top node UID.
 * @param {Object} clonedObjectInfo - info object related to revise and replace.
 * @param {Object} userAction - If true, populate dirt data map.
 */
let propagatePendingActionToChildrenForCloneBelow = function( loadedVMOs, vmo, topUID ) {
    let children = occmgmtUtils.getImmediateChildrenOfGivenParentNode( vmo );
    // Update children if top
    if( children && topUID !== vmo.uid ) {
        for( let i = 0, len = children.length; i < len; i++ ) {
            let cloneInfo = getActualOperationTypeForVMO( children[ i ], false );
            let cloneOperationTypeForItemRev = cloneInfo.cloneOperationType;
            let clonedObjectInfo = cloneInfo.clonedObjectInfo;
            if( cloneOperationTypeForItemRev === null || cloneOperationTypeForItemRev === operationTypes.CLONE_BELOW ) {
                // Update the Column Value to the selected Action
                updateVMOBasedOnAction( children[ i ], operationTypes.CLONE_BELOW, clonedObjectInfo );
                // Recursively updates other children till leaf nodes
                propagatePendingActionToChildrenForCloneBelow( loadedVMOs, children[ i ], topUID );
            } else {
                // Update the Column Value to the selected Action
                updateVMOBasedOnAction( children[ i ], cloneOperationTypeForItemRev, clonedObjectInfo );
                // If operation is already set for item show that operation
                displayActualPendingActionOnChildren( children[ i ], cloneOperationTypeForItemRev );
            }
        }
    }
};

/**
 * Update parent of vmo based on duplicate operation upward.
 *
 * @param {Object} loadedVMOs -all loaded vmos.
 * @param {Object} vmo -selected vmo.
 * @return {Boolean} verdict - return true if upward hierarchy has remove/reference..
 */
let isParentBeingCloned = function( loadedVMOs, vmo ) {
    let parentVMO = getParentVMO( loadedVMOs, vmo );
    if( parentVMO ) {
        let parentCloneOperationType = getEffectiveDuplicateOperation( parentVMO );
        if( operationTypes.CLONE === parentCloneOperationType || operationTypes.CLONE_BELOW === parentCloneOperationType ) {
            return true;
        }
    }
};

/**
 * Update parent of vmo based on duplicate operation upward.
 *
 * @param {Object} loadedVMOs -all loaded vmos.
 * @param {Object} selectedVMO -selected vmo.
 * @param {Object} vmo - vmo.
 * @param {Object} topUID -top node UID.
 * @param {Object} cloneOperationType - duplicate operation type.
 * @param {Object} clonedObjectInfo - info object related to revise and replace.
 * @param {boolean} isDataStoredInXml - boolean variable to store entry in xml or not.
 */
let propagatePendingActionToParents = function( loadedVMOs, selectedVMO, vmo, topUID, cloneOperationType, clonedObjectInfo, isDataStoredInXml ) {
    let parentVMO = getParentVMO( loadedVMOs, vmo );
    if( parentVMO && parentVMO.uid !== topUID ) {
        let parentVMOs = getAllOccurrencesBasedOnIdentifier( loadedVMOs, parentVMO, cloneOperationType );
        for( let i = 0, length = parentVMOs.length; i < length; ++i ) {
            if( parentVMO.uid !== topUID ) {
                let isSelected = selectedVMO.find( function( selectedObject ) {
                    return selectedObject.uid === parentVMOs[ i ].uid;
                } );

                if( !isSelected && ( parentVMO === parentVMOs[ i ] || isParentBeingCloned( loadedVMOs, parentVMOs[ i ] ) ) ) {
                    let cloneOperationTypeToPropagate = cloneOperationType;
                    let cloneInfo = getActualOperationTypeForVMO( parentVMOs[ i ], false );
                    let actualCloneOperationType = cloneInfo.cloneOperationType;
                    clonedObjectInfo = cloneInfo.clonedObjectInfo;
                    if( actualCloneOperationType === operationTypes.CLONE || actualCloneOperationType === operationTypes.CLONE_BELOW ) {
                        cloneOperationTypeToPropagate = actualCloneOperationType;
                    }
                    // Update the Column Value to the selected Action
                    updateVMOBasedOnAction( parentVMOs[ i ], cloneOperationTypeToPropagate, clonedObjectInfo );
                    // Store this to local variable
                    if( isDataStoredInXml ) {
                        mergeOrStoreData( parentVMOs[ i ], cloneOperationTypeToPropagate, clonedObjectInfo );
                    }
                    // Reset it's children to default value
                    displayActualPendingActionOnChildren( parentVMOs[ i ], cloneOperationTypeToPropagate );
                    // Recursively updates other parent till the Root
                    propagatePendingActionToParents( loadedVMOs, selectedVMO, parentVMOs[ i ], topUID, cloneOperationTypeToPropagate, clonedObjectInfo, isDataStoredInXml );
                }
            }
        }
    }
};

export let getEffectiveDuplicateOperation = function( vmo ) {
    let cloneOperationType = 1;
    if( vmo.props && vmo.props.awb0PendingAction && !isNaN( vmo.props.awb0PendingAction.effectiveValue ) ) {
        cloneOperationType = vmo.props.awb0PendingAction.effectiveValue;
    }
    return cloneOperationType;
};

let getActualOperationTypeForVMO = function( vmo, getDefaultOperation ) {
    if( vmo.props && vmo.props[ OCCIDENTIFIERPROPERTY ] ) {
        let itemRevisionUID = vmo.props[ OCCIDENTIFIERPROPERTY ].dbValue;
        if( itemRevisionUID in _duplicateInfo ) {
            return _duplicateInfo[ itemRevisionUID ];
        }
    }

    let cloneOperationType = null;
    let clonedObjectInfo = {};
    if( getDefaultOperation ) {
        cloneOperationType = 1;
    }
    if( vmo.props && vmo.props.awb0PendingAction && vmo.props.awb0PendingAction.dbValue ) {
        cloneOperationType = parseInt( vmo.props.awb0PendingAction.dbValue, 10 );
    }

    if( vmo.props ) {
        let markupPropNamesObj = vmo.props.awb0MarkupPropertyNames;
        let markupPropValuesObj = vmo.props.awb0MarkupPropertyValues;
        if( markupPropNamesObj && markupPropNamesObj.dbValues && markupPropNamesObj.dbValues.length > 0 &&
            markupPropValuesObj && markupPropValuesObj.dbValues && markupPropValuesObj.dbValues.length > 0 ) {
            let markupPropNames = markupPropNamesObj.dbValues;
            let markupDbValues = markupPropValuesObj.dbValues;
            for( let index = 0; index < markupPropNames.length; ++index ) {
                let markupPropName = markupPropNames[ index ];
                if( markupPropName === 'awb0ArchetypeId' ) {
                    clonedObjectInfo.uid = markupDbValues[ index ];
                } else if( markupPropName === 'awb0ArchetypeRevId' ) {
                    if( cloneOperationType === operationTypes.REPLACE ) {
                        clonedObjectInfo.rev = markupDbValues[ index ];
                    }
                    if( cloneOperationType === operationTypes.CLONE || cloneOperationType === operationTypes.CLONE_BELOW ) {
                        clonedObjectInfo.awb0ArchetypeRevId = markupDbValues[ index ];
                    }
                } else if( markupPropName === 'awb0ArchetypeRevName' ) {
                    clonedObjectInfo.awb0ArchetypeRevName = markupDbValues[ index ];
                } else if( markupPropName === 'awb0ArchetypeRevDescription' ) {
                    clonedObjectInfo.awb0ArchetypeRevDescription = markupDbValues[ index ];
                }
            }
        }
    }
    return {
        cloneOperationType: cloneOperationType,
        clonedObjectInfo: clonedObjectInfo
    };
};

/**
 * Updates vmo based on duplicate operation.
 *
 * @param {Object} vmo -selected vmo.
 * @param {Int} cloneOperationType - duplicate operation type.
 * @param {Object} clonedObjectInfo - duplicate operation Info.
 */
let updateVMOBasedOnAction = function( vmo, cloneOperationType, clonedObjectInfo ) {
    if( !vmo.props ) {
        return;
    }
    // set default values on VMO.
    vmo.isDeleted = false;
    vmo.isGreyedOutElement = false;
    resetPropOfVMO( vmo, AWB0ARCHETYPEID );
    resetPropOfVMO( vmo, AWB0ARCHETYPEREVID );
    resetPropOfVMO( vmo, AWB0ARCHETYPEREVNAME );
    resetPropOfVMO( vmo, AWB0ARCHETYPEREVDESC );

    let cloneOperationTypeInternal = cloneOperationType;
    if( cloneOperationType !== operationTypes.IGNORE && isElementUnconfigured( vmo ) ) {
        // Do not show clone operation on unconfigured line unless it is operationTypes.IGNORE
        cloneOperationTypeInternal = operationTypes.REFERENCE;
    }

    updateUiAndEffectiveValueOfVMO( vmo, _validDuplicateOperations[ cloneOperationTypeInternal ], cloneOperationTypeInternal );

    //TODO : probable data mutation case
    if( cloneOperationTypeInternal === operationTypes.IGNORE ) { // For Ignore operation
        vmo.isDeleted = true;
    } else if( cloneOperationTypeInternal === operationTypes.CLONE || cloneOperationTypeInternal === operationTypes.REVISE || cloneOperationTypeInternal === operationTypes.CLONE_BELOW ) {
        updatePropWithNewValue( vmo, AWB0ARCHETYPEID, _localizedPendingString );
        updatePropertiesAsPerCloneObjectInfo( clonedObjectInfo, vmo );
    } else if( cloneOperationTypeInternal === operationTypes.REPLACE ) {
        let replacedObjectUID = _localizedPendingString;
        let replacedObjectRevision = _localizedPendingString;
        if( clonedObjectInfo.uid ) {
            replacedObjectUID = clonedObjectInfo.uid;
            replacedObjectRevision = clonedObjectInfo.rev;
        } else if( clonedObjectInfo.itemRev_uid ) {
            loadAndUpdateUIValue( vmo, clonedObjectInfo.itemRev_uid );
        } else {
            vmo.isGreyedOutElement = true;
            updateUiAndEffectiveValueOfVMO( vmo, _validDuplicateOperations[ operationTypes.REFERENCE ], operationTypes.REPLACE );
            updateModelObject( vmo.uid, cloneOperationTypeInternal, true );
            return;
        }
        updatePropWithNewValue( vmo, AWB0ARCHETYPEID, replacedObjectUID );
        updatePropWithNewValue( vmo, AWB0ARCHETYPEREVID, replacedObjectRevision );
    }
    updateModelObject( vmo.uid, cloneOperationTypeInternal );
};

let resetPropOfVMO = function( vmo, propId ) {
    if( vmo.props && vmo.props[ propId ] ) {
        let oldValue = vmo.props[ propId ].oldValue;
        if( oldValue || _.isEqual( oldValue, '' ) ) {
            vmo.props[ propId ].oldValue = undefined;
            vmo.props[ propId ].uiValue = oldValue;
        }
    }
};
let updatePropWithNewValue = function( vmo, propId, newValue ) {
    if( vmo.props && vmo.props[ propId ] ) {
        let oldValue = vmo.props[ propId ].dbValue;
        vmo.props[ propId ].oldValue = oldValue;
        vmo.props[ propId ].uiValue = newValue;
    }
};
let updateUiAndEffectiveValueOfVMO = function( vmo, uiValue, effectiveCloneOperation ) {
    if( vmo.props && vmo.props.awb0PendingAction ) {
        vmo.props.awb0PendingAction.uiValue = uiValue;
        vmo.props.awb0PendingAction.uiValues = [ uiValue ];
        vmo.props.awb0PendingAction.effectiveValue = effectiveCloneOperation;
    }
};
/**
 * Updates item id and item revision id in case of Replace operation.
 *
 * @param {Object} vmo -selected vmo.
 * @param {String} uid -uid of an Object.
 */
let loadAndUpdateUIValue = function( vmo, uid ) {
    dataManagementSvc.getProperties( [ uid ], [ 'item_id', 'item_revision_id' ] ).then(
        function() {
            let replacedObject = cdm.getObject( uid );
            vmo.props.awb0ArchetypeId.uiValue = replacedObject.props.item_id.dbValues[ 0 ];
            vmo.props.awb0ArchetypeRevId.uiValue = replacedObject.props.item_revision_id.dbValues[ 0 ];
            eventBus.publish( 'reRenderTableOnClient' );
        } );
};
/**
 * Update Model object to support/Un-support of Duplicate Actions based on passed input.
 *
 * @param {String} uid -uid of an Object.
 * @param {Int} cloneOperationType -operation type applied on vmo.
 * @param {Boolean} hideDuplicateCommand -true to hide duplicate action on occurrence.
 */
let updateModelObject = function( uid, cloneOperationType, hideDuplicateCommand ) {
    let viewModelObject = cdm.getObject( uid );
    if( viewModelObject ) {
        if( viewModelObject.props && viewModelObject.props.awb0PendingAction ) {
            viewModelObject.props.awb0PendingAction.dbValue = cloneOperationType;
            if( hideDuplicateCommand ) {
                viewModelObject.props.hideDuplicateCommand = true;
            } else {
                viewModelObject.props.hideDuplicateCommand = false;
            }
        }
    }
};
let mergeOrStoreData = function( vmo, cloneOperationType, clonedObjectInfo ) {
    if( vmo.props && vmo.props[ OCCIDENTIFIERPROPERTY ] ) {
        let itemRevisionUID = vmo.props[ OCCIDENTIFIERPROPERTY ].dbValue;
        let objToStore = {
            element: { uid: vmo.uid, type: vmo.type },
            cloneOperationType: cloneOperationType,
            clonedObjectInfo: clonedObjectInfo
        };
        _duplicateInfo[ itemRevisionUID ] = objToStore;
        _cloneContentData[ itemRevisionUID ] = objToStore;
    }
};

/**
 * Updates VMO decorator based on value of Pending Action column. It first extracts pending action value for a vmo then updates it.
 * It also consider any local changes if made by user and not persisted in DB.
 *
 * @param {Object} vmo - Object to be updated.
 */
export let populateDuplicateActions = function( vmo ) {
    if( vmo && vmo.props && vmo.modelType && vmo.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
        let cloneOperationType = 1; // Default Type
        let cloneOperationTypeParent = 1; // Default Type
        let topUID = appCtxSvc.ctx[ contextKey ].topElement.uid;
        if( vmo.uid === topUID ) {
            cloneOperationType = operationTypes.CLONE; // Top should always clone
            let cloneInfo = getActualOperationTypeForVMO( vmo, true );
            // Store this to local variable
            mergeOrStoreData( vmo, cloneOperationType, cloneInfo.clonedObjectInfo );
            updateVMOBasedOnAction( vmo, cloneOperationType, cloneInfo.clonedObjectInfo );
        } else {
            let loadedVMOs = [];
            if( appCtxSvc.ctx[ contextKey ].vmc ) {
                loadedVMOs = appCtxSvc.ctx[ contextKey ].vmc.getLoadedViewModelObjects();
            }
            let vmos = getAllOccurrencesBasedOnIdentifier( loadedVMOs, vmo );
            vmos.push( vmo );
            for( let i = 0, length = vmos.length; i < length; ++i ) {
                if( !vmos[ i ].props ) {
                    return;
                }
                let clonedObjectInfo = {};
                if( vmos[ i ].props.awb0Parent ) {
                    let parentVMO = getParentVMO( loadedVMOs, vmos[ i ] );
                    if( parentVMO ) {
                        var effectiveDuplicateOperationOnParent = getEffectiveDuplicateOperation( parentVMO );
                        // This check added explicitly to differente BO operation type "Reference" and blank value
                        if( effectiveDuplicateOperationOnParent === operationTypes.REFERENCE && parentVMO.props && parentVMO.props.awb0PendingAction ) {
                            var actualCloneOperationTypeParent = parseInt( parentVMO.props.awb0PendingAction.dbValue, 10 );
                            if( isNaN( actualCloneOperationTypeParent ) ) {
                                cloneOperationTypeParent = null;
                            }
                        } else {
                            cloneOperationTypeParent = effectiveDuplicateOperationOnParent;
                        }
                    }
                }

                var cloneInfo = getActualOperationTypeForVMO( vmos[ i ], false );
                var actualCloneOperationType = cloneInfo.cloneOperationType;
                clonedObjectInfo = cloneInfo.clonedObjectInfo;

                if( cloneOperationTypeParent === null || cloneOperationTypeParent === operationTypes.REFERENCE ) {
                    // when cloneOperationTypeParentis referenced then we need to mark all its children as reference irrespective of BO cosntant on children.
                    if( cloneOperationTypeParent === null && actualCloneOperationType !== null && actualCloneOperationType !== operationTypes.REFERENCE ) {
                        var pendingActionForParent = findCloneOperationTypeToPropagateToParent( loadedVMOs, vmos[ i ] );
                        //In case of BOM assembly expansion we are not going to store any element value in xml hence sending isDataStoredInXml value as false
                        propagatePendingActionToParents( loadedVMOs, vmos, vmos[ i ], topUID, pendingActionForParent, clonedObjectInfo, false );
                    } else {
                        cloneOperationType = operationTypes.REFERENCE;
                    }
                } else {
                    if( cloneOperationTypeParent === operationTypes.CLONE_BELOW && actualCloneOperationType === null ) {
                        cloneOperationType = operationTypes.CLONE_BELOW;
                    } else if( actualCloneOperationType !== null && ( cloneOperationTypeParent === operationTypes.CLONE_BELOW || cloneOperationTypeParent === operationTypes.CLONE ) ) {
                        cloneOperationType = actualCloneOperationType;
                    } else if( actualCloneOperationType === null && cloneOperationTypeParent === operationTypes.CLONE ) {
                        cloneOperationType = operationTypes.REFERENCE;
                    } else {
                        cloneOperationType = cloneOperationTypeParent;
                    }
                }
                updateVMOBasedOnAction( vmos[ i ], cloneOperationType, clonedObjectInfo );
            }
        }
    }
};

/**
 * Set inputs for the duplicate SOA on data.
 */
export let preDuplicateProcessing = function() {
    //Object.values is an experimental feature and it is not being supported in IE yet.
    //data.dataMap = Object.values( _cloneContentData );
    const dataMap = Object.keys( _cloneContentData ).map( function( dupInfo ) { return _cloneContentData[ dupInfo ]; } );
    let cloneFlags = 0;
    const panelSetting = panelSettings.autogen ? {
        autogen: true,
        fromString: '',
        toString: '',
        prefix: '',
        suffix: ''
    } : panelSettings;
    cloneFlags = appCtxSvc.ctx.occmgmtContext.runInBackgroundValue ? cloneFlags + 8 : cloneFlags; // 8 is to run duplicate in background mode
    return { dataMap, cloneFlags, panelSetting };
};

export let saveDuplicateExecutionSettings = function( data ) {
    if( data.defaultIdsOrIdNamingRuleCheckBox ) {
        panelSettings = {
            autogen: data.defaultIdsOrIdNamingRuleCheckBox.dbValue,
            fromString: data.replaceTextBox.dbValue,
            toString: data.withTextBox.dbValue,
            prefix: data.prefixTextBox.dbValue,
            suffix: data.suffixTextBox.dbValue
        };
    }
};
export let getDuplicateExecutionSettings = function() {
    return panelSettings;
};

/**
 * Open cloned structure.
 * @param {Object} notificationObject Notification object.
 */
export let openInteractiveDuplicateNotification = function( notificationObject ) {
    dataManagementSvc.getProperties( [ notificationObject.object.uid ], [ 'fnd0TargetObject' ] ).then(
        function() {
            let notificationObj = cdm.getObject( notificationObject.object.uid );
            let srcUidToken = notificationObj.props.fnd0TargetObject.dbValues[ 0 ];
            dataManagementSvc.loadObjects( [ srcUidToken ] ).then( function() {
                let transitionTo = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
                let toParams = {
                    uid: srcUidToken,
                    page: 'Content',
                    pageId: 'tc_xrt_Content'
                };
                let options = {
                    inherit: false
                };
                LocationNavigationService.instance.go( transitionTo, toParams, options );
            } );
        } );
};

export let setClonedObject = function( data ) {
    if( data.created ) {
        let clonedObjectUID = data.created[ 0 ];
        let sourceObjectUID = null;
        if( appCtxSvc.ctx[ contextKey ].topElement.props.awb0UnderlyingObject ) {
            sourceObjectUID = appCtxSvc.ctx[ contextKey ].topElement.props.awb0UnderlyingObject.dbValues[ 0 ];
        }
        dataManagementSvc.loadObjects( [ clonedObjectUID, sourceObjectUID ] ).then( function() {
            let clonedObject = cdm.getObject( clonedObjectUID );
            let sourceObject = cdm.getObject( sourceObjectUID );
            appCtxSvc.updatePartialCtx( contextKey + '.clonedElement', clonedObject );
            appCtxSvc.updatePartialCtx( contextKey + '.sourceElement', sourceObject );
        } );
    }
};

export let updateCloneObjectInfo = function( vmo ) {
    let cloneInfo = getActualOperationTypeForVMO( vmo, false );
    let awb0ArcheTypeRevId = vmo.props[ AWB0ARCHETYPEREVID ];
    let awb0ArcheTypeRevName = vmo.props[ AWB0ARCHETYPEREVNAME ];
    let awb0ArcheTypeRevDesc = vmo.props[ AWB0ARCHETYPEREVDESC ];
    if( !cloneInfo.elememt ) {
        cloneInfo.element = { uid: vmo.uid, type: vmo.type };
    }
    cloneInfo.cloneOperationType = getEffectiveDuplicateOperation( vmo );

    if( awb0ArcheTypeRevId && awb0ArcheTypeRevId.oldValue && awb0ArcheTypeRevId.uiValue ) {
        cloneInfo.clonedObjectInfo[ awb0ArcheTypeRevId.propertyName ] = awb0ArcheTypeRevId.uiValue;
    }
    if( awb0ArcheTypeRevName && awb0ArcheTypeRevName.oldValue && awb0ArcheTypeRevName.uiValue ) {
        cloneInfo.clonedObjectInfo[ awb0ArcheTypeRevName.propertyName ] = awb0ArcheTypeRevName.uiValue;
    }
    if( awb0ArcheTypeRevDesc && !_.isUndefined( awb0ArcheTypeRevDesc.oldValue ) && awb0ArcheTypeRevDesc.uiValue ) {
        cloneInfo.clonedObjectInfo[ awb0ArcheTypeRevDesc.propertyName ] = awb0ArcheTypeRevDesc.uiValue;
    }
    let itemRevisionUID = vmo.props[ OCCIDENTIFIERPROPERTY ].dbValue;
    _cloneContentData[ itemRevisionUID ] = cloneInfo;
    _duplicateInfo[ itemRevisionUID ] = cloneInfo;
    updateAllOccurrencesBasedOnIdentifier( vmo );
};

let updateAllOccurrencesBasedOnIdentifier = function( vmo ) {
    let loadedVMOs = appCtxSvc.ctx[ contextKey ].vmc.getLoadedViewModelObjects();
    let cloneInfoObject = getActualOperationTypeForVMO( vmo, false );
    let reUsedOccurrences = getAllOccurrencesBasedOnIdentifier( loadedVMOs, vmo, cloneInfoObject.cloneOperationType, cloneInfoObject.clonedObjectInfo );
    for( let index in reUsedOccurrences ) {
        let reUsedOccurrence = reUsedOccurrences[ index ];
        if( isParentBeingCloned( loadedVMOs, reUsedOccurrence ) ) {
            updatePropertiesAsPerCloneObjectInfo( cloneInfoObject.clonedObjectInfo, reUsedOccurrence );
        }
    }
};

let updatePropertiesAsPerCloneObjectInfo = function( clonedObjectInfo, vmo ) {
    if( !_.isUndefined( clonedObjectInfo ) ) {
        if( !_.isUndefined( vmo.props[ AWB0ARCHETYPEREVID ] ) && clonedObjectInfo.awb0ArchetypeRevId ) {
            let revisionId = clonedObjectInfo.awb0ArchetypeRevId;
            updatePropWithNewValue( vmo, AWB0ARCHETYPEREVID, revisionId );
            vmo.props[ AWB0ARCHETYPEREVID ].newValue = revisionId;
        }
        if( !_.isUndefined( vmo.props[ AWB0ARCHETYPEREVNAME ] ) && clonedObjectInfo.awb0ArchetypeRevName ) {
            let revisionName = clonedObjectInfo.awb0ArchetypeRevName;
            updatePropWithNewValue( vmo, AWB0ARCHETYPEREVNAME, revisionName );
            vmo.props[ AWB0ARCHETYPEREVNAME ].newValue = revisionName;
        }
        if( !_.isUndefined( vmo.props[ AWB0ARCHETYPEREVDESC ] ) && clonedObjectInfo.awb0ArchetypeRevDescription ) {
            let revisionDesc = clonedObjectInfo.awb0ArchetypeRevDescription;
            updatePropWithNewValue( vmo, AWB0ARCHETYPEREVDESC, revisionDesc );
            vmo.props[ AWB0ARCHETYPEREVDESC ].newValue = revisionDesc;
        }
    }
};

export let clearDuplicateInfo = function() {
    _duplicateInfo = {};
    panelSettings = {
        autogen: true,
        fromString: '',
        toString: '',
        prefix: '',
        suffix: ''
    };
    clearDuplicateInfoOnContext();
};

let clearDuplicateInfoOnContext = function() {
    Object.keys( _cloneContentData ).forEach( function( key ) {
        delete _cloneContentData[ key ];
    } );
};

/**
 * Interactive Duplicate service utility
 * @param {appCtxService} appCtxSvc - Service to use.
 * @param {editHandlerService} editHandlerService - Service to use.
 * @param {soa_dataManagementService} dataManagementSvc - Service to use.
 * @param {locationNavigationService} locNavSvc - Service to use.
 * @param {soa_kernel_clientDataModel} cdm - Service to use.
 * @param {localeService} localeService - Service to use.
 * @param {localeService} occmgmtUtils - Service to use.
 * @returns {object} - object
 */

export default exports = {
    initialize,
    deleteCloneOptionsFromBWC,
    resetDuplicateActions,
    cancelDuplicateModeAndClearData,
    setDuplicateActionOnLine,
    populateDuplicateActions,
    preDuplicateProcessing,
    openInteractiveDuplicateNotification,
    setClonedObject,
    updateCloneObjectInfo,
    getEffectiveDuplicateOperation,
    clearDuplicateInfo,
    saveDuplicateExecutionSettings,
    getDuplicateExecutionSettings
};
