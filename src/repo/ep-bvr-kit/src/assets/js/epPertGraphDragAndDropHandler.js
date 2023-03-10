// Copyright (c) 2022 Siemens

/**
 * This implements the graph drag and drop handler interface APIs defined by aw-graph widget to provide graph drag and
 * drop functionalities on pert.
 *
 * @module js/epPertGraphDragAndDropHandler
 */
import localeService from 'js/localeService';
import saveInputWriterService from 'js/saveInputWriterService';
import { constants as epSaveConstants } from 'js/epSaveConstants';
import messagingService from 'js/messagingService';
import epSaveService from 'js/epSaveService';
import localStrg from 'js/localStorage';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';

let exports = {};
let draggedAssembly = {};

/**
 * Check whether the graph item could be a target of current DnD operation.
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object[]} draggingGraphItems - array of the graph items been dragging
 * @param {Object} hoveredGraphItem - the graph item under the dragging cursor, null for empty area of the graph
 * @param {Object} dragEffect - String to indicate the gesture, should be 'COPY' or 'MOVE' for paste and cut
 *            respectively
 * @return {Boolean} true - the graph item could be the target, otherwise false.
 */
function isDroppable( graphModel, draggingGraphItems, hoveredGraphItem, dragEffect ) {
    // Just the check the hovered item and dragging items relations
    return checkForDrappableConditions( hoveredGraphItem );
}

function checkForDrappableConditions( hoveredGraphItem ) {
    const mfgReadOnlyMode = appCtxSvc.ctx.mfgReadOnlyMode;
    const topNodeUid = appCtxSvc.ctx.epPageContext.productStructure.uid;
    let isTopNode = false;
    draggedAssembly = JSON.parse( localStrg.get( 'awDragData' ) );
    for( let i = 0; i < draggedAssembly.uidList.length; i++ ) {
        if( draggedAssembly.uidList[ i ] === topNodeUid ) {
            isTopNode = true;
            break;
        }
    }
    if( hoveredGraphItem === null ) {
        return false;
    } else if( mfgReadOnlyMode && mfgReadOnlyMode.readOnlyMode === true ) {
        return false;
    } else if( isTopNode ) {
        return false;
    }
    return true;
}
/**
 * Check whether the graph item can be dragged
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object[]} graphItems - array of the graph items may be dragged
 * @return {Boolean} - true if the graph item is draggable, otherwise false
 */
function isDraggable( graphModel, graphItems ) {
    // In most cases, only the node is draggable
    return true;
}

/**
 * Check whether the graph item can be copied
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object[]} graphItems - array of the graph items may be copied
 * @return {Boolean} - true if the graph item is copyable, otherwise false
 */
function isCopyable( graphModel, graphItems ) {
    return true;
}

/**
 * Check whether the graph item can be dragged. It will be called when a DnD gesture maybe starts, and the return
 * value of this API will determine whether DnD can be continued.
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object[]} graphItems - array of the graph items may be dragged
 * @param {String} dragEffect - "MOVE"/"COPY"
 * @return {Boolean} - true if the graph item is draggable, otherwise false
 */
export function onGraphDragStart( graphModel, graphItems, dragEffect ) {
    if( dragEffect === 'MOVE' ) {
        return isDraggable( graphModel, graphItems );
    } else if( dragEffect === 'COPY' ) {
        return isCopyable( graphModel, graphItems );
    }
    return false;
}

/**
 * API to check whether the graph item can be the target item of the DnD operation
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object[]} draggingGraphItems - array of the graph items been dragging
 * @param {Object} hoveredGraphItem - the graph item under the dragging cursor, null for empty area of the graph
 * @param {String} dragEffect - String to indicate the gesture, should be 'COPY' or 'MOVE' for paste and cut
 *            respectively
 * @param {Object[]} outItems - the dragging graph items just out of graph items, the app can update the status when
 *            the DnD out of some graph items.
 * @param {PointD} cursorLocation - the cursor location
 * @return {Boolean} - true if the hoveredGraphItem is a valid droppable graph item, otherwise false
 */
export function onGraphDragOver( graphModel, draggingGraphItems, hoveredGraphItem, dragEffect, outItems,
    cursorLocation ) {
    if( !cursorLocation ) {
        return false;
    }

    let graph = graphModel.graphControl.graph;
    return isDroppable( graphModel, draggingGraphItems, hoveredGraphItem, dragEffect );
}

/**
 * API to be called when the graph item being dropped on the targetGraphModel
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object[]} draggingGraphItems - array of the graph items been dragging
 * @param {Object} targetGraphItem - the target graph item, null for empty area of the graph
 * @param {String} dragEffect - String to indicate the gesture, should be 'COPY' or 'MOVE' for paste and cut
 *            respectively
 * @param {PointD} cursorLocation - the cursor location
 * @param {PointD} dragDelta - the cursor location
 *
 * @return {Boolean} - true if the app handle the gesture normally, otherwise false to let the GC handle it.
 */
export function onGraphDrop( graphModel, draggingGraphItems, targetGraphItem, dragEffect, cursorLocation,
    dragDelta ) {
    if( !isDroppable( graphModel, draggingGraphItems, targetGraphItem, dragEffect ) ) {
        return false;
    }

    if( draggingGraphItems && draggingGraphItems.length <= 0 ) {
        return false;
    }

    let graph = graphModel.graphControl.graph;
    let isDragWithinDiagram = true;

    //if dragging item is type of string that means its being dragged from outside graph
    if( typeof draggingGraphItems[ 0 ] === 'string' ) {
        isDragWithinDiagram = false;
    }
    if( draggedAssembly && draggedAssembly.uidList.length > 0 && targetGraphItem !== null ) {
        const draggedAssemblyUidList = draggedAssembly.uidList;
        const draggedAssemblyTyepe = draggedAssembly.typeList[ 0 ];
        const resource = localeService.getLoadedText( 'PlanningMessages' );
        const pertNodeData = targetGraphItem.model.modelObject;
        let saveWriter = saveInputWriterService.get();
        let relatedObjects = {
            [ pertNodeData.uid ]: {
                type: pertNodeData.type,
                uid: pertNodeData.uid
            }
        };
        let objectsToModifyEntry = {
            Object: {
                nameToValuesMap: {
                    id: [ pertNodeData.uid ]
                }
            }
        };
        let objectToAdd = [];
        //Handling dragging and dropping of multiple asselmblies
        _.forEach( draggedAssemblyUidList, function( uid ) {
            relatedObjects[ uid ] = {
                type: draggedAssemblyTyepe,
                uid: uid
            };
            objectToAdd.push( uid );
            objectsToModifyEntry.ProductScopes = {
                nameToValuesMap: {
                    Add: objectToAdd
                }
            };
        } );
        saveWriter.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, objectsToModifyEntry );
        epSaveService.saveChanges( saveWriter, true, relatedObjects ).then( function( response ) {
            if( response.ServiceData ) {
                const saveEventsArray = response.saveEvents;
                const modelOject = response.ServiceData.modelObjects;
                let assemblyNameArray = [];
                let pertNodeName = '';
                _.forEach( saveEventsArray, function( params ) {
                    if( params.eventType === 'addedToRelation' ) {
                        assemblyNameArray.push( modelOject[ params.eventObjectUid ].props.object_string.uiValues[ 0 ] );
                    }
                    if( params.eventType === 'modifyRelations' ) {
                        pertNodeName = modelOject[ params.eventObjectUid ].props.object_string.uiValues[ 0 ];
                    }
                } );

                if( assemblyNameArray.length > 0 ) {
                    const assemblyName = assemblyNameArray.join( ',' );
                    let meesage = resource.scopingSuccessMsg;
                    meesage = meesage.format( assemblyName, pertNodeName );
                    messagingService.showInfo( meesage );
                }
            }
        } );
    }
    return true;
}

export default exports = {
    onGraphDragStart,
    onGraphDragOver,
    onGraphDrop
};
