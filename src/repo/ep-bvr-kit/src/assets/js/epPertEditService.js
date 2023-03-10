// Copyright (c) 2022 Siemens

/**
 * This service helps delete the graph data to be displayed and also saves it.
 *
 * @module js/epPertEditService
 */
import cdm from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import _ from 'lodash';
import { constants as epSaveConstants } from 'js/epSaveConstants';
import eventBus from 'js/eventBus';
import epPertGraphRenderSevice from 'js/epPertGraphRenderService';
import graphModelService from 'js/graphModelService';
import messagingService from 'js/messagingService';
import localeService from 'js/localeService';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import mfeContentPanelUtil from 'js/mfeContentPanelUtil';
import mfeViewModelObjectLifeCycleService from 'js/services/mfeViewModelObjectLifeCycleService';
import epWorkflowIndicationService from 'js/epWorkflowIndicationService';

const MFE_KEY_LOCALSTORAGE = ':/mfe/';
const MFE_PREDECESSORS_KEY = 'mfePredecessorNodes';
const PERT_MESSAGES = '/i18n/PertMessages';
const EXTERNAL_SUCCESSORS = 'ExternalSuccessors';
const EXTERNAL_PREDECESSORS = 'ExternalPredecessors';

/**
 * Create and publish PERT data.
 * @param {*} eventData - Event data
 * @param {*} graphModel - graphModel
 */
function createPublishPertData( eventData, graphModel, subPanelContext ) {
    let objectUids = Object.keys( graphModel.dataModel.nodeModels );
    _.forEach( eventData.saveEvents, function( event ) {
        if( event.eventType === 'create' ) {
            objectUids.push( event.eventObjectUid );
        }
    } );

    if( objectUids.length > subPanelContext.sharedSelectionData.pertContent.length ) {
        objectUids.forEach( objUid => {
            if( !subPanelContext.sharedSelectionData.pertContent.includes( objUid ) ) {
                subPanelContext.sharedSelectionData.pertContent.push( objUid );
            }
        } );
    }

    if( objectUids && objectUids.length > 0 ) {
        const pertData = {
            nodes: [],
            edges: [],
            ports: []
        };
        //create a relevant nodes
        const modelObjsCreated = _.map( objectUids, ( uid ) => mfeViewModelObjectLifeCycleService.createViewModelObjectFromModelObject( cdm.getObject( uid ) ) );
        pertData.nodes = modelObjsCreated;
        eventBus.publish( graphModel.graphDataProvider.name + '.graphDataLoaded', { graphData: pertData } );
    }
}

/**
 * Select the PERT node representing newly created Process Area object.
 *
 * @param {Object} data - Event map data
 * @param {Object} graphModel - the graph model
 */
export function selectRecentPertNode( data, graphModel ) {
    let nodes = _.uniq( data.nodes );

    if( nodes.length === 1 ) {
        //Clear the node selection.
        //We use graphModel.graphControl.setSelected() twice for selecting nodes because first we need to
        //clear the graph selection and then we have to set the selection in graphModel. This causes the sync
        //action to call twice and Summary view breaks due to this as it checks if data is updated or not.
        //Hence to avoid this, we are caliing graphModel.graphControl._diagramView.setSelected() first to
        //clear the selection so that it does not fire selection event twice. This is a workaround.
        graphModel.graphControl._diagramView.setSelected( null );
        //Select the recently created node
        graphModel.graphControl.setSelected( nodes, true, null );
    }
}

/**
 * Select the PERT node after the breadcrumb change.
 *
 * @param {Object} syncObject - syncObject after breadcrumb
 * @param {Object} graphModel - the graph model
 */
export function setSeletionInPert( syncObject, graphModel ) {
    if( syncObject ) {
        graphModel.graphControl.graph.getNodes().forEach( graphNode => {
            if( graphNode.model.id === syncObject.uid ) {
                graphModel.graphControl.setSelected( [ graphNode ], true );
                appCtxService.unRegisterCtx( 'syncObject' );
            }
        } );
    }
}

export function removeNodes( deleteEventData, graphModel, tabContext ) {
    // check for the eventData and remove only those nodes which got deleted from server .
    let nodesToDelete = [];
    const graph = getGraph( graphModel );

    let selectedPertNodes = graphModel.graphControl.getSelected( 'Node' );
    if( deleteEventData && deleteEventData.length > 0 ) {
        selectedPertNodes.forEach( node => {
            nodesToDelete = nodesToDelete.concat( selectedPertNodes.filter( d => deleteEventData.includes( _.get( d, 'model.nodeObject.uid' ) ) ) );
        } );
    }
    graph.removeNodes( nodesToDelete, true );
    setPertNodesSelection( graphModel, tabContext );
    if( doesImplicitFlowExist( nodesToDelete, graphModel ) ) {
        eventBus.publish( 'awGraph.initialized' );
    } else {
        resetLayout( graphModel );
    }
}

/**
 * Check if the deleted node causes any implicit flow to be created
 * @param {Array} nodesToDelete nodesToDelete
 * @param {Object} graphModel graphModel
 * @returns {Boolean} true if implicit flow exists, false otherwise
 */
function doesImplicitFlowExist( nodesToDelete, graphModel ) {
    let hasPredecessor = false;
    let hasSuccessor = false;

    //check if it has a predecessor and successor so that implicit flow is created and we need to reload the Pert graph
    nodesToDelete.some( node => {
        if( node.model.nodeObject.props.Mfg0predecessors ) {
            hasPredecessor = node.model.nodeObject.props.Mfg0predecessors.dbValues.length > 0;
        }

        //check if it has a successor
        for( const obj in graphModel.dataModel.nodeModels ) {
            if( graphModel.dataModel.nodeModels[ obj ].nodeObject.props.Mfg0predecessors ) {
                hasSuccessor = graphModel.dataModel.nodeModels[ obj ].nodeObject.props.Mfg0predecessors.dbValues.includes( node.model.nodeObject.uid );
                if( hasPredecessor && hasSuccessor ) {
                    return hasPredecessor && hasSuccessor;
                }
            }
        }
    } );
    return hasPredecessor && hasSuccessor;
}

/**
 * This function sets selected nodes in ctx
 * @param {Object} graphModel graphModel
 */
export function setPertNodesSelection( graphModel, tabContext ) {
    let selectedPertNodes = graphModel.graphControl.getSelected( 'Node' );
    let selectedPertEdges = graphModel.graphControl.getSelected( 'Edge' );
    let nodeObjectIds = [];
    if( selectedPertNodes && selectedPertNodes.length > 0 ) {
        selectedPertNodes.forEach( node => {
            nodeObjectIds.push( node.model.nodeObject );
        } );
    }
    mfeContentPanelUtil.setCommandContext( tabContext, {
        selection: nodeObjectIds,
        edgeSelections : selectedPertEdges,
        graphModel : graphModel
    } );
    return nodeObjectIds;
}

/**
 * get graph from graphModel
 * @param {*} graphModel - graphModel
 * @return{*} graph - graph
 */
function getGraph( graphModel ) {
    return graphModel.graphControl.graph;
}

/**
 * Create Edge
 * @param {*} predModelObj - Predecessor Model Object
 * @param {*} succModelObject - Sucessor Model Object
 * @param {*} operationType - Operaion Type
 * @param {*} saveInputWriter - saveInputWriter
 */
function edgeOperations( predModelObj, succModelObject, operationType, saveInputWriter ) {
    let relatedObjects = [];

    let edgeObject = {};
    if( operationType === 'Add' ) {
        edgeObject.objectId = succModelObject.uid;
        edgeObject.predecessorId = predModelObj.uid;
        saveInputWriter.addPredecessor( edgeObject, 'true' );
    } else {
        edgeObject.fromId = predModelObj.uid;
        edgeObject.toId = succModelObject.uid;
        saveInputWriter.deleteFlow( edgeObject, 'true' );
    }
    relatedObjects.push( succModelObject );
    relatedObjects.push( predModelObj );
    saveInputWriter.addRelatedObjects( relatedObjects );
    return saveInputWriter;
}

/**
 * Function to be called to tell if the edge was permitted to create from this source
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} source - the source whether the edge can be created from
 * @return {boolean} flag whether the edge can be reconnected
 */
export function canCreateEdgeFrom( graphModel, source ) {
    if( !source || !graphModel ) {
        return false;
    }
    if( !_.isEmpty( source.getItemType() ) && ( source.getItemType() === 'Port' || source.getItemType() === 'Node' ) ) {
        return true;
    }
}

/**
 * Function to be called to tell if the edge was permitted to create from this source
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} target - the target whether the edge can be created to
 * @return {boolean} flag whether the edge can be reconnected
 */
export function canCreateEdgeTo( graphModel, target ) {
    if( !target || !graphModel ) {
        return false;
    }
    if( !_.isEmpty( target.getItemType() ) && ( target.getItemType() === 'Port' || target.getItemType() === 'Node' ) ) {
        return true;
    }
}

/**
 * This function checks whether the edge lready exists between given nodes
 * @param {*} graphModel
 * @param {*} previewEdge
 */
export function doesEdgeAlreadyExistBetweenNodes( edges, firstNodeUid, secondNodeUid ) {
    let edgeExists = false;
    for( const edge in edges ) {
        if( edges[ edge ].edgeObject.puid === firstNodeUid && edges[ edge ].edgeObject.suid === secondNodeUid ||
            edges[ edge ].edgeObject.suid === firstNodeUid && edges[ edge ].edgeObject.puid === secondNodeUid ) {
            edgeExists = true;
        }
    }
    return edgeExists;
}

/**
 * Function to create edge.
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} previewEdge - the preview edge.
 */
export function createEdge( graphModel, previewEdge ) {
    let saveInputWriter = saveInputWriterService.get();
    edgeOperations( previewEdge.getSourceNode().model.modelObject,
        previewEdge.getTargetNode().model.modelObject, 'Add', saveInputWriter );
    epSaveService.saveChanges( saveInputWriter, true ).then( function( response ) {
        if( !response.saveResults ) {
            graphModel.graphControl.graph.removeEdges( [ previewEdge ] );
        }
        const loadedMOs = response.saveResults.map( obj => response.ServiceData.modelObjects[ obj.saveResultObject.uid ] );
        updateGraphModelWithLoadedModelObjects( graphModel, loadedMOs );
        updateGraphModelWithCreatedEdge( graphModel, previewEdge );
        resetLayout( graphModel );
    } );
}

/**
 * graphModel needs to updated when any modelObject for an object present in datamodel is changed
 * @param {*} graphModel
 * @param {*} loadedMOs
 */
function updateGraphModelWithLoadedModelObjects( graphModel, loadedMOs ) {
    loadedMOs.forEach( modelObj => {
        const vmo = mfeViewModelObjectLifeCycleService.createViewModelObjectFromModelObject( modelObj );
        let vindicators = graphModel.dataModel.nodeModels[ modelObj.uid ].nodeObject.indicators;
        vmo.indicators = vindicators;
        const nodeModel = new graphModelService.NodeModel( vmo.uid, vmo );
        const graphItem = graphModel.dataModel.nodeModels[ vmo.uid ].graphItem;
        graphModel.addNodeModel( graphItem, nodeModel );
    } );
}

/**
 * Update graphModel with newly created edge
 * @param {*} graphModel graphModel
 * @param {*} previewEdge previewEdge
 */
function updateGraphModelWithCreatedEdge( graphModel, previewEdge ) {
    const sourceNodeModel = previewEdge.getSourceNode();
    const targetNodeModel = previewEdge.getTargetNode();
    const edgeObject = {
        id: `edge_id${Math.random().toString()}`,
        puid: sourceNodeModel.model.id,
        suid: targetNodeModel.model.id,
        props: {}
    };
    const edgeModel = new graphModelService.EdgeModel( edgeObject.id, edgeObject, edgeObject.category, sourceNodeModel.model, targetNodeModel.model, edgeObject.edgeLabelText );
    graphModel.addEdgeModel( previewEdge, edgeModel );
}

/**
 * Removes the given edge from layout data model
 *
 * @param selectedEdges connection/edge reference to be removed from layout data model
 * @param graphModel graph model
 * @param tabContext context
 */
export function removeEdge( selectedEdges, graphModel, tabContext ) {
    const graph = getGraph( graphModel );
    let saveInputWriter = saveInputWriterService.get();
    if( selectedEdges && selectedEdges.length > 0 ) {
        selectedEdges.forEach( edge => {
            edgeOperations( edge.getSourceNode().model.modelObject,
                edge.getTargetNode().model.modelObject, 'Remove', saveInputWriter );
        } );
    }

    epSaveService.saveChanges( saveInputWriter, true ).then( function( result ) {
        let layout = graphModel.graphControl.layout;
        if( !result.ServiceData.partialErrors ) {
            graph.removeEdges( selectedEdges );
            resetLayout( graphModel );
        }
        // TODO applyLayout again on server response layout.addEdge( previewEdge, true );
    } );

    setPertNodesSelection( graphModel, tabContext );
}

/**
 * Reset the PERT nodes to default layout.
 * @param {Object} graphModel - graphModel
 */
export function resetLayout( graphModel ) {
    const graphControl = graphModel.graphControl;
    graphControl.layout.applyLayout();
    graphControl.layout.activate();
    graphControl.fitGraph();
}

/**
 * Move graph items and update layout
 * @param {Array} items - moved graph items
 * @param {*} graphModel - graphModel
 */
export function moveGraphItems( items, graphModel ) {
    if( items.length > 0 ) {
        const movedNodes = items.filter( ( item ) => item.getItemType() === 'Node' );
        const layout = graphModel.graphControl.layout;
        moveElements( movedNodes, layout );
    }
}

/**
 * Move elements with incremental / sorted layout update
 * @param {*} movedNodes - movedNodes
 * @param {*} layout - layout
 */
function moveElements( movedNodes, layout ) {
    if( layout !== undefined && layout.isActive() && !_.isEmpty( movedNodes ) ) {
        layout.applyUpdate( () => {
            movedNodes.forEach( ( node ) => {
                layout.moveNode( node );
            } );
        } );
    }
}


/**
 * This method updates node bindData when on save event
 * @param {Array} saveEventObject - save events
 * @param {Object} graphModel - graphModel
*/
export function updateNodeBindDataForSaveEvents( saveEventObject, graphModel ) {
    const eventObjectIds = new Set();
    const modelObjects = [];
    if ( saveEventObject.saveEvents ) {
        saveEventObject.saveEvents.forEach( event=>{
            eventObjectIds.add( event.eventObjectUid );
        } );
        for ( const objectid of eventObjectIds ) {
            let  vmo =  mfeViewModelObjectLifeCycleService.createViewModelObjectFromUid( objectid );
            modelObjects.push( vmo );
        }
    }
    updateNodeBindData( modelObjects, graphModel );
}

/**
 * This method updates node bindData when save edit is performed in summary tab
 * @param {Array} modelObjects - modelObjects
 * @param {Object} graphModel - graphModel
 */
export function updateNodeBindData( modelObjects, graphModel ) {
    if( modelObjects ) {
        modelObjects.forEach( obj => {
            if( obj.uid in graphModel.dataModel.nodeModels ) {
                let vmo = obj;
                /*
                SaveData of any kind will send the modelObjects to the pert.
                This method will get the epVmo and update the graphModel
                */
                if( !obj.indicators ) {
                    vmo = mfeViewModelObjectLifeCycleService.createViewModelObjectFromModelObject( obj );
                    let vindicators = graphModel.dataModel.nodeModels[ obj.uid ].nodeObject.indicators;
                    vmo.indicators = vindicators;
                }
                epWorkflowIndicationService.updateVmoToWorkflow( vmo );
                const nodeModel = {
                    modelObject: vmo
                };
                const bindData = epPertGraphRenderSevice.getNodeBindData( graphModel, nodeModel );
                graphModel.graphControl.graph.updateNodeBinding( graphModel.dataModel.nodeModels[ obj.uid ].graphItem, bindData );
                graphModel.dataModel.nodeModels[ vmo.uid ].modelObject = vmo;
                graphModel.dataModel.nodeModels[ vmo.uid ].nodeObject = vmo;
            }
        } );
    }
}

/**
 * This method remove the nodes after sync in graph data model.
 * @param {Object} graphModel - graphModel
 */
export function removeNodesAfterSync( graphModel ) {
    let nodesToDeleteUids = [];
    const graph = getGraph( graphModel );
    const contextModelObj = appCtxService.getCtx( 'ep.scopeObject' );
    let actualSubElements = contextModelObj.props.Mfg0sub_elements.dbValues;
    let nodeModalElemets = [];
    for( const node in graphModel.dataModel.nodeModels ) {
        nodeModalElemets.push( node );
    }
    if( actualSubElements.length !== nodeModalElemets.length ) {
        nodesToDeleteUids = nodeModalElemets.filter( x => !actualSubElements.includes( x ) );
        let nodesToDelete = [];
        nodesToDeleteUids.forEach( ( nodeToDelete ) => {
            nodesToDelete.push( graphModel.dataModel.nodeModels[ nodeToDelete ].graphItem );
        } );
        graph.removeNodes( nodesToDelete, true );
    }
}

/**
 * This method sets the given nodes as predecessors and stores them in localstorage
 * @param {Array} predecessorNodes node to be set as predecessor
 */
export function setPertNodeAsPredecessor( graphModel, predecessorNodes ) {
    const selectedPertNodes = graphModel.graphControl.getSelected( 'Node' );
    let predNodes = [];
    if( selectedPertNodes && selectedPertNodes.length > 1 ) {
        predNodes = selectedPertNodes.map( node => node.model.nodeObject );
        setPredecessorNodesInStorageAndDisplayMessage( predNodes );
    } else if( predecessorNodes ) {
        setPredecessorNodesInStorageAndDisplayMessage( predecessorNodes );
    }
}

/**
 * This method sets given nodes in localStorage and displays information message
 * @param {Array/Object} predecessorNodes predecessorNodes
 */
export function setPredecessorNodesInStorageAndDisplayMessage( predecessorNodes ) {
    const resource = localeService.getLoadedText( PERT_MESSAGES );
    if( typeof predecessorNodes === 'string' ) {
        predecessorNodes = mfeViewModelObjectLifeCycleService.createViewModelObjectFromUid( predecessorNodes );
    }
    localStorage.setItem( MFE_PREDECESSORS_KEY + MFE_KEY_LOCALSTORAGE, JSON.stringify( predecessorNodes ) );
    appCtxService.updatePartialCtx( 'ep.isPredecessorSetForPert', true );
    if( Array.isArray( predecessorNodes ) && predecessorNodes.length > 1 ) {
        messagingService.showInfo( resource.multipleNodesSetAsPredecessorMessage.format( predecessorNodes.length ) );
    } else {
        messagingService.showInfo( resource.singleNodeSetAsPredecessorMessage.format( predecessorNodes.props.object_string.dbValues[ 0 ] ) );
    }
}

/**
 * This method sets the given node as successor and creates the scope flow
 * @param {Object} successorNode successorNode
 */
export function setAsSuccessorAndCreateFlow( successorNode ) {
    let saveInputWriter = saveInputWriterService.get();
    const predecessorNodes = JSON.parse( localStorage.getItem( MFE_PREDECESSORS_KEY + MFE_KEY_LOCALSTORAGE ) );
    if( successorNode ) {
        if( predecessorNodes.length > 1 ) {
            predecessorNodes.forEach( pred => {
                edgeOperations( pred,
                    successorNode, 'Add', saveInputWriter );
            } );
        } else {
            edgeOperations( predecessorNodes,
                successorNode, 'Add', saveInputWriter );
        }
    }

    epSaveService.saveChanges( saveInputWriter, true ).then( ( response ) => {
        if( !response.ServiceData.partialErrors ) {
            if( response.saveEvents ) {
                const parsedAddRemoveSaveEvents = epSaveService.parseSaveEvents( response.saveEvents );
                const relevantEvents = parsedAddRemoveSaveEvents[ EXTERNAL_SUCCESSORS ];
                if( relevantEvents ) {
                    if( relevantEvents.eventObjectUid === successorNode.uid ) {
                        const relatedEvents = relevantEvents.relatedEvents;
                        const objUidToAddList = relatedEvents[ epSaveConstants.ADDED_TO_RELATION ];
                        addExternalNodesToObjectPropertyCache( objUidToAddList, successorNode.uid );
                    }
                } else {
                    eventBus.publish( 'awGraph.initialized' );
                }
            }
        }
    } );
}

/**
 * This method iterates over all the predecessor nodes for selected pert node and sets ExternalPredecessors and
 * ExternalSuccessors properties in ep cache for given node
 * @param {Array / Object} predecessorNodes predecessorNodes
 * @param {Object} successorNode successorNode
 */
function addExternalNodesToObjectPropertyCache( predecessorNodes, successorNode ) {
    let externalPredecessorsForPertNode = epObjectPropertyCacheService.getProperty( successorNode, EXTERNAL_PREDECESSORS );
    externalPredecessorsForPertNode = externalPredecessorsForPertNode ? externalPredecessorsForPertNode : [];
    if( Array.isArray( predecessorNodes ) ) {
        predecessorNodes.forEach( pred => {
            externalPredecessorsForPertNode.push( updatePropertyObjectCacheForExternalNodes( pred, successorNode ) );
        } );
    } else {
        externalPredecessorsForPertNode.push( updatePropertyObjectCacheForExternalNodes( predecessorNodes, successorNode ) );
    }
    epObjectPropertyCacheService.setProperty( successorNode, EXTERNAL_PREDECESSORS, externalPredecessorsForPertNode );
}

/**
 * Updates ExternalSuccessors property in ep cache for given predecessor node
 * @param {*} predecessorNode predecessorNode
 * @param {*} successorNode successorNode
 */
function updatePropertyObjectCacheForExternalNodes( predecessorNode, successorNode ) {
    let externalSuccessorsForPertNode = epObjectPropertyCacheService.getProperty( predecessorNode, EXTERNAL_SUCCESSORS );
    if( externalSuccessorsForPertNode ) {
        externalSuccessorsForPertNode.push( successorNode );
        epObjectPropertyCacheService.setProperty( predecessorNode, EXTERNAL_SUCCESSORS, externalSuccessorsForPertNode );
    }
    return predecessorNode;
}

/**
 * This method removes scope flows between selected PERT node and selected nodes from External Flows table
 * @param {Array} objectsToDelete objectsToDelete
 * @param {*} connectToObject connectToObject
 */
export function removeScopeFlows( objectsToDelete, connectToObject ) {
    let saveInputWriter = saveInputWriterService.get();
    if( objectsToDelete ) {
        // show the confirmation message
        const resource = localeService.getLoadedText( PERT_MESSAGES );
        const removeScopeFlowsConfirmationMessage = getLocalizedMessage( resource, objectsToDelete );
        mfgNotificationUtils.displayConfirmationMessage( removeScopeFlowsConfirmationMessage, resource.remove, resource.discard ).then( () => {
            const externalPredecessorsForPertNode = epObjectPropertyCacheService.getProperty( connectToObject.uid, EXTERNAL_PREDECESSORS );
            const externalSuccessorsForPertNode = epObjectPropertyCacheService.getProperty( connectToObject.uid, EXTERNAL_SUCCESSORS );
            objectsToDelete.forEach( obj => {
                if( externalPredecessorsForPertNode && externalPredecessorsForPertNode.includes( obj.uid ) ) {
                    edgeOperations( obj,
                        connectToObject, 'Remove', saveInputWriter );
                }
                if( externalSuccessorsForPertNode && externalSuccessorsForPertNode.includes( obj.uid ) ) {
                    edgeOperations( connectToObject,
                        obj, 'Remove', saveInputWriter );
                }
            } );

            epSaveService.saveChanges( saveInputWriter, true ).then( ( response ) => {
                if( !response.ServiceData.partialErrors ) {
                    if( response.saveEvents ) {
                        const parsedAddRemoveSaveEvents = epSaveService.parseSaveEvents( response.saveEvents );
                        const relevantEvents = [ parsedAddRemoveSaveEvents[ EXTERNAL_SUCCESSORS ], parsedAddRemoveSaveEvents[ EXTERNAL_PREDECESSORS ] ];
                        if( relevantEvents ) {
                            relevantEvents.forEach( event => {
                                if( event.eventObjectUid === connectToObject.uid ) {
                                    const relatedEvents = event.relatedEvents;
                                    const objUidToRemoveList = relatedEvents[ epSaveConstants.REMOVED_FROM_RELATION ];
                                    removeExternalNodesFromObjectPropertyCache( objUidToRemoveList, connectToObject.uid, externalPredecessorsForPertNode,
                                        externalSuccessorsForPertNode );
                                }
                            } );
                        }
                    }
                }
            } );
        } );
    }
}

/**
 * This method removes the objects to delete from ExternalPredecessors and ExternalSuccessors properties in ep cache
 * @param {Array} objectsToDelete objectsToDelete
 * @param {Object} connectToObject connectToObject
 * @param {Array} externalPredecessorsForPertNode externalPredecessorsForPertNode
 * @param {array} externalSuccessorsForPertNode externalSuccessorsForPertNode
 */
function removeExternalNodesFromObjectPropertyCache( objectsToDelete, connectToObject, externalPredecessorsForPertNode, externalSuccessorsForPertNode ) {
    objectsToDelete.forEach( objUid => {
        if( externalPredecessorsForPertNode.includes( objUid ) ) {
            epObjectPropertyCacheService.removeProperty( connectToObject, EXTERNAL_PREDECESSORS, objUid );
            epObjectPropertyCacheService.removeProperty( objUid, EXTERNAL_SUCCESSORS, connectToObject );
        } else if( externalSuccessorsForPertNode.includes( objUid ) ) {
            epObjectPropertyCacheService.removeProperty( connectToObject, EXTERNAL_SUCCESSORS, objUid );
            epObjectPropertyCacheService.removeProperty( objUid, EXTERNAL_PREDECESSORS, connectToObject );
        }
    } );
}

/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {String} localTextBundle - The message bundles localized files
 * @param {String} objectsToDelete - The objects to delete
 * @returns {String} localizedValue - The localized message string
 */
function getLocalizedMessage( localTextBundle, objectsToDelete ) {
    return objectsToDelete && objectsToDelete.length === 1 ? localTextBundle.removeSingleScopeFlowMessage.format( objectsToDelete[ 0 ].props.object_string.uiValues[ 0 ] ) :
        localTextBundle.removeMultipleScopeFlowsMessage.format( objectsToDelete.length );
}

/**
 * Select given Pert node and set External Flows tab as selected
 * @param {Object} graphModel graphModel
 * @param {Object} item pert node to select
 */
export function selectPertNodeAndLoadExternalFlowsTab( graphModel, item ) {
    if( graphModel && item && item.graphItem ) {
        //clear previous selection and select given pert node
        graphModel.graphControl._diagramView.setSelected( null );
        graphModel.graphControl.setSelected( [ item.graphItem ], true, null );

        //set External Flows tab as selected
        const tab = {
            tabKey: 'EpExternalFlows'
        };
        eventBus.publish( 'awTab.setSelected', tab );
    }
}

let exports = {};
export default exports = {
    createPublishPertData,
    selectRecentPertNode,
    removeNodes,
    setPertNodesSelection,
    canCreateEdgeFrom,
    canCreateEdgeTo,
    createEdge,
    removeEdge,
    resetLayout,
    moveGraphItems,
    updateNodeBindData,
    doesEdgeAlreadyExistBetweenNodes,
    removeNodesAfterSync,
    setSeletionInPert,
    setPertNodeAsPredecessor,
    setPredecessorNodesInStorageAndDisplayMessage,
    setAsSuccessorAndCreateFlow,
    removeScopeFlows,
    selectPertNodeAndLoadExternalFlowsTab,
    updateNodeBindDataForSaveEvents
};
