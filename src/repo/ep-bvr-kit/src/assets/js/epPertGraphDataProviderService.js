// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 */

/**
 * This is a service for loading and saving data for PERT
 *
 * @module js/epPertGraphDataProviderService
 */

import cdm from 'soa/kernel/clientDataModel';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import eventBus from 'js/eventBus';
import epLoadInputHelper from 'js/epLoadInputHelper';
import epLoadService from 'js/epLoadService';
import appCtxService from 'js/appCtxService';
import mfeVMOService from 'js/services/mfeViewModelObjectLifeCycleService';
import AwPromiseService from 'js/awPromiseService';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';
import pertLocalStorageService from 'js/pertLocalStorageService';
import mfeContentPanelUtil from 'js/mfeContentPanelUtil';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import mfeViewModelUtils from 'js/mfeViewModelUtils';
import dataMgmtService from 'soa/dataManagementService';
import epWorkflowIndicationService from 'js/epWorkflowIndicationService';
import propPolicySvc from 'soa/kernel/propertyPolicyService';

const MFE_KEY_LOCALSTORAGE = ':/mfe/';
const MFE_PREDECESSORS_KEY = 'mfePredecessorNodes';

/**
 * Load PERT data to be passed to graphDataProvider
 *
 * @param {Object} contextObjectForPert - contextObjectForPert
 */
export const loadPertData = function( contextObjectForPert ) {
    const loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( 'Pert', contextObjectForPert.uid );
    const pertLoadResponseObject = {};

    return epLoadService.loadObject( loadTypeInputs, false ).then( function( response ) {
        pertLoadResponseObject.response = response;
        if( response.loadedObjectsMap.ChangeNoticeRevision ) {
            appCtxService.updatePartialCtx( 'ep.mcnObject', response.loadedObjectsMap.ChangeNoticeRevision[ 0 ] );
        }
        if ( response.relatedObjectsMap.hasOwnProperty( contextObjectForPert.uid ) && response.relatedObjectsMap[contextObjectForPert.uid].additionalPropertiesMap2
            && response.relatedObjectsMap[contextObjectForPert.uid].additionalPropertiesMap2.pertContent ) {
            pertLoadResponseObject.pertContent = response.relatedObjectsMap[contextObjectForPert.uid].additionalPropertiesMap2.pertContent;
        }
        return pertLoadResponseObject;
    } );
};

/**
 * Load graph data after graph is initialized.
 * @param {*} graphModel graphModel
 * @param {*} subPanelContext subPanelContext
 */
function loadGraphData( graphModel, subPanelContext ) {
    updatePertDataProvider( subPanelContext ).then( function( res ) {
        const pertData = {
            nodes: [],
            edges: [],
            ports: []
        };
        pertData.nodes = Object.assign( pertData.nodes, res );
        addExternalPredAndSuccInfoToCache( pertData.nodes, subPanelContext.sharedSelectionData.pertLoadResponse );
        eventBus.publish( graphModel.graphDataProvider.name + '.graphDataLoaded', { graphData: pertData } );
        loadPertDataFromLocalStorageAndUpdateCtx();
        mfeContentPanelUtil.setCommandContext( subPanelContext, {
            graphModel : graphModel,
            contextObject: cdm.getObject( subPanelContext.contextObject.uid ),
            pertContent: subPanelContext.sharedSelectionData.pertContent
        } );
    } );
}

/**
 * This method adds ExternalPredecessors and ExternalSuccessors psuedo properties to EP cache.
 * @param {Array} loadedVMOs loaded pert node VMOs
 * @param {*} loadObjectResponse load object response
 */
function addExternalPredAndSuccInfoToCache( loadedVMOs, loadObjectResponse ) {
    loadedVMOs.forEach( vmo => {
        if( vmo && loadObjectResponse.relatedObjectsMap.hasOwnProperty( vmo.uid ) ) {
            if( loadObjectResponse.relatedObjectsMap[vmo.uid].additionalPropertiesMap2.ExternalPredecessors ) {
                epObjectPropertyCacheService.setProperty( vmo.uid, 'ExternalPredecessors', loadObjectResponse.relatedObjectsMap[vmo.uid].additionalPropertiesMap2.ExternalPredecessors );
            }else if( loadObjectResponse.relatedObjectsMap[vmo.uid].additionalPropertiesMap2.ExternalSuccessors ) {
                epObjectPropertyCacheService.setProperty( vmo.uid, 'ExternalSuccessors', loadObjectResponse.relatedObjectsMap[vmo.uid].additionalPropertiesMap2.ExternalSuccessors );
            }
        }
    } );
}

/**
 * Update PERT dataProvider to be passed to graphDataProvider
 *
 * @param {Object} subPanelContext - subPanelContext
 */
export const updatePertDataProvider = function( subPanelContext ) {
    const contextModelObj = cdm.getObject( subPanelContext.contextObject.uid );
    let instance = AwPromiseService.instance;
    let deferred = AwPromiseService.instance.defer();
    const promiseAll = [];
    const graphNodeUids = [];

    //create all of the relevant nodes
    if( subPanelContext.sharedSelectionData.pertContent && subPanelContext.sharedSelectionData.pertContent.length > 0 ) {
        graphNodeUids.push( ...subPanelContext.sharedSelectionData.pertContent );
    }

    if( graphNodeUids ) {
        graphNodeUids.forEach( function( uid ) {
            let modelObj = cdm.getObject( uid );
            let promise = mfeVMOService.createViewModelObjectFromModelObject( modelObj );
            
            epWorkflowIndicationService.updateVmoToWorkflow( promise );
            promiseAll.push( promise );
        } );
    }

    return instance.all( promiseAll );
};

/**
 * Update node binding data of node on hover for showing Open command
 * @param {Object} hoveredItem - hoveredItem
 * @param {Object} unHoveredItem - unHoveredItem
 * @param {Object} graphModel - graphModel
 */
export const showOpenCommandOnHover = function( hoveredItem, unHoveredItem, graphModel ) {
    if( hoveredItem && hoveredItem.getItemType() === 'Node' ) {
        const bindData = {
            isNodeHovered: true
        };
        graphModel.graphControl.graph.updateNodeBinding( hoveredItem, bindData );
    }
    if( unHoveredItem && unHoveredItem.getItemType() === 'Node' ) {
        const bindData = {
            isNodeHovered: false
        };
        graphModel.graphControl.graph.updateNodeBinding( unHoveredItem, bindData );
    }
};

/**
 * This method is used to toggle the PERT mode or PRI mode for Show In PERT Diagram command. Also sets the context object for PERT view.
 * @param {Boolean} isPertModeActive boolean indicating if Pert mode is active
 * @param {Object} contextObject context bject for PERT
 * @param {Object} highLevelPlanningProcessLayoutAreaContext Shared context between Process tree and PERT view
 * @returns {Object} Shared context between Process tree and PERT view
 */
export const setPertModeAndUpdateCommandContext = function (commandContext, sharedSelectionData) {
    let isPertModeActive = JSON.parse(sharedSelectionData.isPertModeActive);
    let isPRIModeActive = JSON.parse(sharedSelectionData.isPRIModeActive);

    /* load Mfg0processResources property to check if PERT should be shown or PRI should be shown.
    If process resource exists under selected node, then show PRI else show PERT. */
    return dataMgmtService.getProperties([sharedSelectionData.selected[0].uid], [epBvrConstants.MFG_PROCESS_RESOURCES]).then(function () {
        const selectedObject = cdm.getObject(sharedSelectionData.selected[0].uid);
        const isProcessStationSelectedAndContainsProcessResources = selectedObject.modelType.typeHierarchyArray.includes('Mfg0BvrProcessStation')
            && selectedObject.props[epBvrConstants.MFG_PROCESS_RESOURCES]
            && selectedObject.props[epBvrConstants.MFG_PROCESS_RESOURCES].dbValues.length > 0;

        const pertLoadResponseObject = {};
        /* As Process resource is not present, show PERT view. */
        if (!isPertModeActive && !isProcessStationSelectedAndContainsProcessResources && !isPRIModeActive) {
            return loadPertData(sharedSelectionData.selected[0]).then((responseObj) => {
                mfeContentPanelUtil.setCommandContext(sharedSelectionData, {
                    isPertModeActive: !isPertModeActive,
                    contextObjectForPert: isPertModeActive ? null : cdm.getObject(sharedSelectionData.selected[0].uid),
                    pertContent: responseObj.pertContent,
                    pertLoadResponse: responseObj.response
                });
                commandContext.tabs.forEach(tabModel => {
                    tabModel.contextObject = cdm.getObject(sharedSelectionData.selected[0].uid);
                });
            });
        }
        /* As Process resource is present, show PRI view. */
        else if (!isPertModeActive && isProcessStationSelectedAndContainsProcessResources && !isPRIModeActive) {
            return loadStationPRI(sharedSelectionData.selected[0]).then( () => {
                mfeContentPanelUtil.setCommandContext(sharedSelectionData, {
                    isPRIModeActive: !isPRIModeActive,
                    stationAndPrSelection: {
                        station: cdm.getObject( sharedSelectionData.selected[0].uid ),
                        pr: null
                    }
                });
            });
        }
        else if (isPertModeActive) {
            mfeContentPanelUtil.setCommandContext(sharedSelectionData, {
                isPertModeActive: !isPertModeActive,
                contextObjectForPert: isPertModeActive ? null : cdm.getObject(sharedSelectionData.selected[0].uid)
            });
        }
        else if( isPRIModeActive ){
            mfeContentPanelUtil.setCommandContext( sharedSelectionData, {
                isPRIModeActive: !isPRIModeActive
            } );
        }

        commandContext.tabs.forEach(tabModel => {
            tabModel.contextObject = cdm.getObject(sharedSelectionData.selected[0].uid);
        });
    });

};

/**
 * This method makes a load call for loading data related to PRI for stations
 * @param {Object} selectedObject 
 * @returns 
 */
function loadStationPRI( selectedObject ){
    const policy = {
        types: [ {
            name: 'Mfg0BvrProcessStation',
            properties: [ { name: 'bl_parent' },
                {
                    name: 'Mfg0processResources',
                    modifiers: [ {
                        name: 'withProperties',
                        Value: 'true'
                    } ]
                },
                { name: 'elb0cycleTime' },
                { name: 'elb0unassignedTimeByPV' },
                { name: 'mbc0CommentText' },
                { name: 'elb0taktTime' },
                { name: 'elb0workContentByPV' }
            ]
        }, {
            name: 'Mfg0BvrProcessResource',
            properties: [ { name: 'bl_parent' },
                { name: 'awb0BomLineItemId' },
                { name: 'elb0taktTime' },
                { name: 'elb0workContentByPV' },
                { name: 'bl_rev_object_name' },
                { name: 'capacity' },
                { name: 'elb0sharedWithStations' },
                { name: 'mbc0processResourceType' },
                {
                    name: 'elb0allocatedOpsByPV',
                    modifiers: [ {
                        name: 'withProperties',
                        Value: 'true'
                    } ]
                }
            ]
        }, {
            name: 'Mfg0BvrOperation',
            properties: [
                { name: 'elb0allocatedTimeByPV' },
                { name: 'bl_parent' },
                { name: 'elb0startTime' },
                { name: 'Mfg0predecessors' },
                { name: 'Mfg0processResource' }
            ]
        } ]
    };
    propPolicySvc.register( policy );
    const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.STATION_PRI, epLoadConstants.GET_PROPERTIES, epLoadConstants.PRODUCTION_PROGRAM ], 
        selectedObject.uid, [ 'elb0cycleTime', 'elb0taktTime', 'elb0taktTimeConverted', 'elb0workContentByPV' ] );
    return epLoadService.loadObject( loadTypeInput, false );
}

/**
 * Load Pert data from local storage and update it to ctx so that conditions can access it in visibleWhen.
 */
export const loadPertDataFromLocalStorageAndUpdateCtx = function() {
    const externalPredecessorNodes = pertLocalStorageService.getFromStorage( MFE_PREDECESSORS_KEY + MFE_KEY_LOCALSTORAGE );
    if( externalPredecessorNodes ) {
        appCtxService.updatePartialCtx( 'ep.isPredecessorSetForPert', true );
    }
};


/**
 * Load Target Assemblies associated with selected Process node
 * @param { Object } selectedProcessNode Process node
 * @return { promise } promise of Target Assemblies response
 */
export function getTargetAssemblies( selectedProcessNode ) {
    const processNode = Array.isArray( selectedProcessNode ) ? cdm.getObject( selectedProcessNode[ 0 ].uid ) : cdm.getObject( selectedProcessNode.uid );
    const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.GET_PROPERTIES ], processNode.uid, [ epBvrConstants.TARGET_ASSEMBLY_PROPERTY ] );
    return epLoadService.loadObject( loadTypeInput ).then( () => {
        return processNode.props[ epBvrConstants.TARGET_ASSEMBLY_PROPERTY ] ? processNode.props[ epBvrConstants.TARGET_ASSEMBLY_PROPERTY ].dbValues : [];
    } );
}

/**
 * Update sharedSelectionData based on selection in PERT. If nothing is selected, then update it with contextObject.
 * @param {Object} targetAtomicData
 * @param {Object} subPanelContext
 */
export function updateSharedSelectionData( targetAtomicData, subPanelContext ) {
    const objectsToSelectInBOPTree = subPanelContext.selection.length ? subPanelContext.selection : [ subPanelContext.contextObject ];
    mfeViewModelUtils.mergeValueInAtomicData( targetAtomicData, {
        selected : objectsToSelectInBOPTree
    } );
}

// eslint-disable-next-line no-unused-vars
let exports = {};
export default exports = {
    loadGraphData,
    loadPertData,
    showOpenCommandOnHover,
    updatePertDataProvider,
    setPertModeAndUpdateCommandContext,
    loadPertDataFromLocalStorageAndUpdateCtx,
    getTargetAssemblies,
    updateSharedSelectionData
};
