// Copyright (c) 2022 Siemens

/**
 * Service used highlighting selected nodes in respective tree
 *
 * @module js/ssp0SelectionSyncService
 *
 */

import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import ssp0BackingObjectProviderService from 'js/ssp0BackingObjectProviderService';
import ssp0VisViewerUtilityService from 'js/ssp0VisViewerUtilityService';

let exports = {};
 let expandMode = false;

 /**
   * Get Node to be searched in IModelObject form
   * @param {Object} selectedObjects selectedObjects
   * @return {Array} array of objects
   */
 export let getNodeToBeSearched = function( selectedObjects ) {
     if ( selectedObjects ) {
         let selectedObjectsArray = [];
         selectedObjects.forEach( selectedObject => {
             selectedObjectsArray.push( { uid: selectedObject.uid, type: selectedObject.type } );
         } );
         return selectedObjectsArray;
     }
 };

 /**
    * Prepare path for expansion of node
    * @param {Object} response response
    * @return {Object} object contains uid
    */
 let preparePath = function( response ) {
     if ( response ) {
         const plains = response.ServiceData.plain;
         const resultNodes = response.resultInfo[0].resultNodes;
         let foundNode = [];
         resultNodes.forEach( resultNode => {
             foundNode.push( resultNode.foundNodes[0].uid );
         } );
         const path = [];

         Object.values( plains ).filter( plain => !foundNode.includes( plain ) ).forEach( plain => {
             path.push( ssp0BackingObjectProviderService.getDesignElementObject( plain ) );
         } );

         return path;
     }
 };

 /**
    * Expand the tree
    * @param {Object} nodeToExpand nodeToExpand
    * @param {Object} dataProvider dataProvider
    */
 let expandTree = function( nodeToExpand, dataProvider ) {
     if ( dataProvider.viewModelCollection !== null ) {
         let vmoCollection = dataProvider.getViewModelCollection().loadedVMObjects;
         let vmos = vmoCollection.filter( obj => {
             return obj.uid === nodeToExpand;
         } );
         if ( vmos && vmos.length === 1 ) {
             if ( !vmos[0].isExpanded ) {
                 expandMode = true;
                 vmos[0].isExpanded = true;
                 eventBus.publish( 'sbomTree.plTable.toggleTreeNode', vmos[0] );
             } else {
                 expandMode = false;
             }
         } else {
             // Log the errors
         }
     }
 };

 /**
    * Highlight the give nodes
    * @param {Object} nodesToBeHighlighted nodesToBeHighlighted
    * @param {Object} dataProvider dataProvider
    */
 let highlightNode = function( nodesToBeHighlighted, dataProvider ) {
     if ( dataProvider && dataProvider.viewModelCollection !== null ) {
         let vmoCollection = dataProvider.getViewModelCollection().loadedVMObjects;
         let vmos = [];
         vmoCollection.forEach( vmo => {
             if ( nodesToBeHighlighted.includes( vmo.uid ) ) {
                 vmos.push( vmo );
             }
         } );
         if ( vmos && vmos.length > 0 ) {
             dataProvider.selectNone();
             dataProvider.selectionModel.addToSelection( vmos );
         }
     }
 };

 /**
    * Get Nodes To BeHighlighted
    * @param {Array} resultNodes resultNodes
    * @returns{Array} nodesToBeHighlighted
    */
 let getNodesToBeHighlighted = function( resultNodes ) {
     let foundNodes = [];
     resultNodes.forEach( resultNode => {
         foundNodes.push( resultNode.foundNodes[0] );
     } );
     let nodesToBeHighlighted = [];
     foundNodes.forEach( node => {
         nodesToBeHighlighted.push( ssp0BackingObjectProviderService.getDesignElementObject( node.uid ) );
     } );
     return nodesToBeHighlighted;
 };

 /**
    * Select Node in Tree
    * @param {object} response response of SOA
    * @param {object} data data
    */
 export let selectNodeInSBOMTree = function( response, data ) {
     if ( response && response.resultInfo[0] && response.resultInfo[0].resultNodes[0] && response.resultInfo[0].resultNodes[0].foundNodes[0] ) {
         const path = preparePath( response );
         const resultNodes = response.resultInfo[0].resultNodes;
         const nodeToBeHighlighted = getNodesToBeHighlighted( resultNodes );
         const copyOfPath = preparePath( response );
         const dataProvider = data.dataProviders.sbomTreeDataProvider;
         expandMode = false;
         // Prepare path
         for ( const node of copyOfPath ) {
             if ( path.length > 0 && !expandMode ) {
                 // Subscribe event
                 const subscribeTreeNodesLoaded = eventBus.subscribe( 'sbomTreeDataProvider.treeNodesLoaded', function( eventData ) {
                     if ( path.length > 0 ) {
                         // take out 1st node
                         const nodeToExpand = path.shift();
                         expandTree( nodeToExpand, dataProvider );
                     } else {
                         highlightNode( nodeToBeHighlighted, dataProvider );
                         eventBus.unsubscribe( subscribeTreeNodesLoaded );
                     }
                 } );
                 // take out 1st node
                 const nodeToExpand = path.shift();
                 expandTree( nodeToExpand, dataProvider );
             }
         }
         if ( !path.length > 0 ) {
             highlightNode( nodeToBeHighlighted, dataProvider );
         }
     }
 };

 /**
    * Get selected nodes ids
    * @param {Array} selectedObjectsArray Array of selected vmo
    * @returns {Array} Array of selected nodes Id
    */
 export let getSelectedNodeInSBOM = ( selectedObjectsArray ) => {
     if ( selectedObjectsArray.ids && selectedObjectsArray.ids.length > 0 ) {
         return {
             selectedObjectsArray: selectedObjectsArray.ids
         };
     }
     return { selectedObjectsArray: [] };
 };

 /**
    * Get selected nodes ids
    * @param {Array} vmos viewModelObjects
    * @param {String} viewerId viewerId
    * @returns {Object} An object contains array of bomLines and state of selection of node
    */
 export let getSelectNodes = ( vmos, viewerId ) => {
     let isSelected = false;
     let bomLineUidArray = [];
     if ( vmos.length > 0 ) {
         vmos.forEach( vmo => {
             let bomLineUid = ssp0BackingObjectProviderService.getBomLineUid( vmo );
             bomLineUidArray.push( bomLineUid.bomLineUid );
         } );

         isSelected = true;
     } else {
         ssp0VisViewerUtilityService.clearSelectionInViewer( viewerId );
     }
     return {

         bomLineUid: bomLineUidArray,
         isSelected: isSelected
     };
 };

 /**
    * Deselect nodes in dataProvider
    * @param {Object} dataProvider dataProvider
    */
 export let clearSelectionInTree = ( dataProvider ) => {
     if ( dataProvider ) {
         dataProvider.selectNone();
     }
 };

 /**
    * Set toggle state in Ctx
    * @param {Object} toggleState toggleState
    */
 export let setToggleStateInCtx = ( toggleState ) => {
     if ( typeof appCtxSvc.ctx.selectionSyncToggleState !== 'undefined' ) {
         appCtxSvc.registerCtx( 'selectionSyncToggleState', toggleState );
     }
     appCtxSvc.updateCtx( 'selectionSyncToggleState', toggleState );
 };

 export const handleSelectionChange = ( selectedObjects ) => {
     return selectedObjects ? selectedObjects : [];
 };

 /**
    * Get Parent Node of Tree
    * @param {Object} dataProvider dataProvider
    * @return {String} uid of Service Plan
    */
 export let getParentNode = function( dataProvider ) {
     if ( dataProvider ) {
         let parentNode = dataProvider.viewModelCollection.loadedVMObjects[0];
         const objects = ssp0BackingObjectProviderService.getBomLines( [ parentNode ] );
         return objects[0];
     }
     return {};
 };

 export default exports = {
     getParentNode,
     handleSelectionChange,
     setToggleStateInCtx,
     clearSelectionInTree,
     getSelectNodes,
     getSelectedNodeInSBOM,
     selectNodeInSBOMTree,
     getNodeToBeSearched
 };

