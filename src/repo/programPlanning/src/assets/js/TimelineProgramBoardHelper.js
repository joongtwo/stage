// Copyright (c) 2022 Siemens

/**
 * @module js/TimelineProgramBoardHelper
 */
import cdm from 'soa/kernel/clientDataModel';
import ppConstants from 'js/ProgramPlanningConstants';
import localeSvc from 'js/localeService';
import selectionSvc from 'js/selection.service';

var exports = {};

var prepareProgramBoard = function( relatedObjects, data ) {
    var loadedProgramObjects = [];
    var programRelatedObjUIDMap = {};
    var prgBoardUidToConvertedUidMap = {};
    var programObjectList = relatedObjects;

    if( programObjectList ) {
        programObjectList.forEach( function( programObject ) {
            var contextObject = programObject.contextObject;
            if( contextObject ) {
                var status = contextObject.uid;
                var loadedObjects = programObject.loadedObjects;
                if( loadedObjects ) {
                    loadedObjects.forEach( function( loadedObject ) {
                        var objectUID = loadedObject.uid;
                        var object = cdm.getObject( objectUID );
                        var id = objectUID.concat( '||',
                            status ); // use case: when duplicate object like same Risk is attached to two events is coming for two lanes , need to make id as unique.
                        var text = getObjectName( object );
                        var date = getDatePropertyValue( object );
                        var leftIconUid = object.uid; // Default to object uid.
                        var iconTooltip = null;
                        var responsibleUser = getResponsibleUser( object );
                        var rightIconUID = null;
                        var showRightIcon = false;
                        var cssClass = 'aw-programPlanning-programBoardCard aw-aria-border';
                        // If there is a resposible user property, assign the value to the icon uid.
                        if( responsibleUser.hasProperty === true ) {
                            rightIconUID = responsibleUser.value;
                            if( responsibleUser.value === null ) {
                                iconTooltip = getPgp0LocalizedText( 'unassigned' );
                            }
                            showRightIcon = true;
                        }

                        if( object ) {
                            var kanbanObject = {
                                id: id,
                                status: status,
                                text: text,
                                tags: [ date ],
                                $css: cssClass,
                                leftIconUID: leftIconUid,
                                rightIconUID: rightIconUID,
                                iconTooltip: iconTooltip,
                                showRightIcon: showRightIcon
                            };
                            loadedProgramObjects.push( kanbanObject );
                            programRelatedObjUIDMap[ id ] =
                                objectUID; // prepare map of key as conext object and related object UID, and value is actual uid of related object, this will be used in drag/drop and in the other actions.
                            prgBoardUidToConvertedUidMap[ objectUID ] = id;
                        }
                    } );
                }
            }
        } );
    }
    data.programRelatedObjUIDMap = programRelatedObjUIDMap; // populating in the data for further user
    data.prgBoardUidToConvertedUidMap = prgBoardUidToConvertedUidMap;
    return loadedProgramObjects;
};

var getDatePropertyValue = function( object ) {
    var date = '';
    if( object.modelType.typeHierarchyArray.indexOf( 'Psi0PrgDelRevision' ) > -1 || object.modelType.typeHierarchyArray.indexOf( 'Psi0AbsChecklist' ) > -1 && object.props.psi0DueDate ) {
        date = object.props.psi0DueDate.uiValues[ 0 ];
    } else if( object.modelType.typeHierarchyArray.indexOf( 'Schedule' ) > -1 && object.props.finish_date ) {
        date = object.props.finish_date.uiValues[ 0 ];
    } else if( object.modelType.typeHierarchyArray.indexOf( 'Psi0AbsRIO' ) > -1 && object.props.psi0TargetDate ) {
        date = object.props.psi0TargetDate.uiValues[ 0 ];
    }
    return date;
};

var getObjectName = function( object ) {
    if( object.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
        return object.props.object_string.uiValues[ 0 ];
    }
    return object.props.object_name.uiValues[ 0 ];
};

var getResponsibleUser = function( object ) {
    var responsibleUser = {
        hasProperty: false,
        value: null
    };

    if( ( object.modelType.typeHierarchyArray.indexOf( 'Psi0PrgDelRevision' ) > -1 || object.modelType.typeHierarchyArray.indexOf( 'Psi0AbsRIO' ) > -1 ) && object.props.psi0ResponsibleUsr ) {
        responsibleUser.hasProperty = true;
        responsibleUser.value = object.props.psi0ResponsibleUsr.dbValues[ 0 ];
    }

    if( object.modelType.typeHierarchyArray.indexOf( 'Psi0AbsChecklist' ) > -1 && object.props.psi0ResponsibleUser ) {
        responsibleUser.hasProperty = true;
        responsibleUser.value = object.props.psi0ResponsibleUser.dbValues[ 0 ];
    }

    if( object.modelType.typeHierarchyArray.indexOf( 'Prg0AbsCriteria' ) > -1 && object.props.fnd0ResponsibleUser ) {
        responsibleUser.hasProperty = true;
        responsibleUser.value = object.props.fnd0ResponsibleUser.dbValues[ 0 ];
    }

    return responsibleUser;
};
export let prepareProgramBoardData = function( ctx, data ) {
    var loadedObjects = prepareProgramBoard( ctx.timelineProgramBoard.relatedObjects, data );
    // timelineUtils.setTimelineHeight( ctx );
    data.totalFound = loadedObjects.length;
    data.loadObjects = loadedObjects;
};

export let closeProgramBoard = function( ctx ) {
    if( ctx.activeProgramBoard === true ) {
        ctx.activeProgramBoard = false;
        //timelineUtils.updateTimelineHeight();
    }
};

export let initProgramBoard = function( ctx ) {
    ctx.activeProgramBoard = true;
    //timelineUtils.setTimelineHeight( ctx );
};

/**
 * Prepares the inputs for createRelations.
 * @param {Object} data The viewModel object
 * @returns {array} The inputs for createRelations
 */
export let getCreateRelationsInput = function( data ) {
    var dragDropContext = data.eventMap[ 'ProgramBoard.onAfterDrop' ];
    var programRelatedObjUIDMap = data.programRelatedObjUIDMap;
    var inputs = [];
    if( dragDropContext && programRelatedObjUIDMap ) {
        var draggedObjectUidArray = dragDropContext.dragContext.source;
        var targetObjectUid = dragDropContext.dragContext.to.config.status;
        var targetObject = cdm.getObject( targetObjectUid );

        if( targetObject ) {
            draggedObjectUidArray.forEach( function( objUid ) {
                var draggedObjectUID = programRelatedObjUIDMap[ objUid ];
                if( draggedObjectUID ) {
                    var draggedObject = cdm.getObject( draggedObjectUID );

                    if( draggedObject ) {
                        var relationType = exports.getValidRelationType( targetObject, draggedObject );
                        var inputData = {
                            primaryObject: targetObject,
                            secondaryObject: draggedObject,
                            relationType: relationType,
                            clientId: draggedObjectUID,
                            userData: ''
                        };
                        inputs.push( inputData );
                    }
                }
            } );
        }
    }
    return inputs;
};

/**
 * Prepares the inputs for deleteRelations.
 * @param {Object} data The viewModel object
 * @returns {array} The inputs for deleteRelations
 */
export let getDeleteRelationsInput = function( data ) {
    var dragDropContext = data.eventMap[ 'ProgramBoard.onAfterDrop' ];
    var programRelatedObjUIDMap = data.programRelatedObjUIDMap;
    var inputs = [];
    if( dragDropContext && programRelatedObjUIDMap ) {
        var sourceObjectUid = dragDropContext.dragContext.from.config.status;
        var draggedObjectUidArray = dragDropContext.dragContext.source;
        var sourceObject = cdm.getObject( sourceObjectUid );
        if( sourceObject ) {
            draggedObjectUidArray.forEach( function( objUid ) {
                var draggedObjectUID = programRelatedObjUIDMap[ objUid ];
                if( draggedObjectUID ) {
                    var draggedObject = cdm.getObject( draggedObjectUID );

                    if( draggedObject ) {
                        var relationType = exports.getValidRelationType( sourceObject, draggedObject );
                        var inputData = {
                            primaryObject: sourceObject,
                            secondaryObject: draggedObject,
                            relationType: relationType,
                            clientId: '',
                            userData: ''
                        };
                        inputs.push( inputData );
                    }
                }
            } );
        }
    }

    return inputs;
};

/**
 * Prepares the inputs for setProperties.
 * @param {Object} data The viewModel object
 * @returns {array} The inputs for setProperties
 */
export let setPropertiesInput = function( data ) {
    var dragDropContext = data.eventMap[ 'ProgramBoard.onAfterDrop' ];
    var programRelatedObjUIDMap = data.programRelatedObjUIDMap;
    var inputs = [];
    if( dragDropContext && programRelatedObjUIDMap ) {
        var targetObjectUid = dragDropContext.dragContext.to.config.status;
        var draggedObjectUidArray = dragDropContext.dragContext.source;
        draggedObjectUidArray.forEach( function( objUid ) {
            var draggedObjectUID = programRelatedObjUIDMap[ objUid ];
            if( draggedObjectUID ) {
                var draggedObject = cdm.getObject( draggedObjectUID );

                if( draggedObject ) {
                    var inputData = {
                        object: draggedObject,
                        vecNameVal: [

                            {
                                name: 'prg0EventObject',
                                values: [
                                    targetObjectUid
                                ]
                            }
                        ]
                    };
                    inputs.push( inputData );
                }
            }
        } );
    }

    return inputs;
};

export let getValidRelationType = function( contextObject, selectedObject ) {
    if( contextObject.modelType.typeHierarchyArray.indexOf( ppConstants.OBJECT_TYPE.PROGRAM ) > -1 ) {
        if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.CHANGEREQUEST ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_PROGRAM.CHANGEREQUEST;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.CHANGENOTICE ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_PROGRAM.CHANGEREQUEST;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.PRGDEL ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_PROGRAM.PRGDEL;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.OPPORTUNITY ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_PROGRAM.OPPORTUNITY;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.ISSUE ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_PROGRAM.ISSUE;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.RISK ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_PROGRAM.RISK;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.SCH ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_PROGRAM.SCH;
        }
    } else if( contextObject.modelType.typeHierarchyArray.indexOf( ppConstants.OBJECT_TYPE.EVENT ) > -1 ) {
        if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.CHANGENOTICE ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_EVENT.CHANGENOTICE;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.CHANGEREQUEST ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_EVENT.CHANGENOTICE;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.PRGDEL ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_EVENT.PRGDEL;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.OPPORTUNITY ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_EVENT.OPPORTUNITY;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.ISSUE ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_EVENT.ISSUE;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.RISK ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_EVENT.RISK;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.SCH ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_EVENT.SCH;
        } else if( selectedObject.modelType.typeHierarchyArray.indexOf( ppConstants.INPUT_TYPES.CHECKLIST ) > -1 ) {
            return ppConstants.VALID_RELATION_TYPE_FOR_EVENT.CHECKLIST;
        }
    }
};

export let loadProgrmBoardColumns = function( ctx ) {
    return {
        columnInfos: ctx.timelineProgramBoard.column
    };
};

export let syncProgramBoardSelection = function( data ) {
    var selectedObjectUids = data.eventData.selectedObjectUids;
    var convertedUids = [];
    selectedObjectUids.forEach( function( uid ) {
        var id = data.programRelatedObjUIDMap[ uid ];
        if( id ) {
            convertedUids.push( id );
        }
    } );
    var selectedObjects = [];
    for( var i = 0; i < convertedUids.length; i++ ) {
        var object = cdm.getObject( convertedUids[ i ] );
        if( object ) {
            selectedObjects.push( object );
        }
    }
    if( selectedObjects && selectedObjects.length > 0 ) {
        selectionSvc.updateSelection( selectedObjects );
    }
};

export let updateRelatedBoardData = function( data ) {
    var updatedCards = [];
    var updatedObjects = data.eventData.updatedObjects;
    updatedObjects.forEach( function( object ) {
        if( object ) {
            var updatedUid = data.prgBoardUidToConvertedUidMap[ object.uid ];
            if( updatedUid ) {
                var text = getObjectName( object );
                var date = getDatePropertyValue( object );
                var kanbanObject = {
                    id: updatedUid,
                    text: text,
                    tags: [ date ]
                };
                updatedCards.push( kanbanObject );
            }
        }
    } );
    return updatedCards;
};

/**
 *  Gets failed uids from SOA response of createRelations
 * @param {Object} response SOA response
 * @param {Map} prgBoardUidToConvertedUidMap prgBoardUidToConvertedUidMap
 * @returns {array} The falied uids.
 */
export let getFailedUidsForCreateRelations = function( response, prgBoardUidToConvertedUidMap ) {
    var faliedUids = [];
    var partialErrors = response.ServiceData.partialErrors;
    if( partialErrors && prgBoardUidToConvertedUidMap ) {
        partialErrors.forEach( function( partialError ) {
            var faliedUid = partialError.clientId;
            if( faliedUid ) {
                faliedUids.push( prgBoardUidToConvertedUidMap[ faliedUid ] );
            }
        } );
    }

    return faliedUids;
};

/**
 *  Gets failed uids from SOA response of createRelations
 * @param {Object} response SOA response
 * @param {Map} prgBoardUidToConvertedUidMap prgBoardUidToConvertedUidMap
 * @returns {array} The falied uids.
 */
export let getFailedUidsForSetProperties = function( response, prgBoardUidToConvertedUidMap ) {
    var faliedUids = [];
    var partialErrors = response.ServiceData.partialErrors;
    if( partialErrors && prgBoardUidToConvertedUidMap ) {
        partialErrors.forEach( function( partialError ) {
            var faliedUid = partialError.uid;
            if( faliedUid ) {
                faliedUids.push( prgBoardUidToConvertedUidMap[ faliedUid ] );
            }
        } );
    }

    return faliedUids;
};

var getPgp0LocalizedText = function( key ) {
    var resource = 'ProgramPlanningCommandPanelsMessages';
    var localeTextBundle = localeSvc.getLoadedText( resource );
    return localeTextBundle[ key ];
};

export default exports = {
    prepareProgramBoardData,
    closeProgramBoard,
    initProgramBoard,
    getCreateRelationsInput,
    getDeleteRelationsInput,
    setPropertiesInput,
    getValidRelationType,
    loadProgrmBoardColumns,
    syncProgramBoardSelection,
    updateRelatedBoardData,
    getFailedUidsForCreateRelations,
    getFailedUidsForSetProperties
};
