/* eslint-disable max-len */
// Copyright (c) 2022 Siemens

/**
 * Service to PLF columns Properties in SBOM Tree
 *
 * @module js/ssp0PLFTablePropertyRenderer
 */

import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import constantsService from 'soa/constantsService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import soaSvc from 'soa/kernel/soaService';
import ssp0TableCellRenderer from 'js/ssp0TableCellRenderer';

'use strict';
let exports = {};

 let traceableMap = new Map();
 let serializedMap = new Map();
 let lotMap = new Map();
 let pQuantityMap = new Map();
 let rotableMap = new Map();
 let consumableMap = new Map();
 let assetMap = new Map();

 const RESOURCE_MESSAGE = 'ssp0Messages';

 /**
  * Calls a method get the relation name of part and PLF.
  * @return {Promise} deferred promise
  */
 export let getPLF = function() {
     let deferred = AwPromiseService.instance.defer();
     const Smr0PartLogisticsFormDefaultRelationCtx = appCtxSvc.getCtx( 'Smr0PartLogisticsFormDefaultRelation' );
     if ( !Smr0PartLogisticsFormDefaultRelationCtx ) {
         let keys = [ 'Smr0PartLogisticsFormDefaultRelation' ];

         constantsService.getGlobalConstantValues2( keys ).then( function( response ) {
             let constantVal = response.constantValues[0].value[0];
             let defaultValue = 'IMAN_reference';
             if ( constantVal !== null ) {
                 appCtxSvc.updateCtx( 'Smr0PartLogisticsFormDefaultRelation', constantVal );
             } else {
                 appCtxSvc.updateCtx( 'Smr0PartLogisticsFormDefaultRelation', defaultValue );
             }
             deferred.resolve();
         }, function( reason ) {
             deferred.reject( reason );
         } ).then( getPLFList, function() { } );
     } else {
         getPLFList();
     }
     return deferred.promise;
 };


 /**
  * Calls a method get partLogisticForm list using  mroPartList and the relation.
  * @return {Promise} deferred promise
  */
 let getPLFList = function() {
     let deferred = AwPromiseService.instance.defer();
     const mroPartListInput = appCtxSvc.getCtx( 'MROPartListInput' );
     let Smr0PartLogisticsFormDefaultRelation = appCtxSvc.getCtx( 'Smr0PartLogisticsFormDefaultRelation' );
     if ( !Smr0PartLogisticsFormDefaultRelation ) {
         Smr0PartLogisticsFormDefaultRelation = 'IMAN_reference';
     }

     const input = {
         primaryObjects: mroPartListInput,
         pref: {
             expItemRev: true,
             info: [ {
                 relationName: appCtxSvc.ctx.Smr0PartLogisticsFormDefaultRelation,
                 objectTypeNames: [ 'PartLogisticsForm' ]
             } ]
         }
     };

     let mroPartList = [];
     let PLFList = [];

     soaSvc.post( 'Core-2007-06-DataManagement', 'expandGRMRelationsForPrimary', input ).then( function( response ) {
         let outputArray = _.values( response.output );
         let itr = 0;
         _.forEach( outputArray, function( output ) {
             mroPartList[itr] = output.inputObject;
             PLFList[itr] = output.otherSideObjData[0].otherSideObjects[0];
             itr++;
         } );

         appCtxSvc.updateCtx( 'MROPartList', mroPartList );
         appCtxSvc.updateCtx( 'PLFList', PLFList );
         eventBus.publish( 'sbomTree.plTable.clientRefresh' );
         deferred.resolve();
     }, function( reason ) {
         deferred.reject( reason );
     } );

     return deferred.promise;
 };

 /**
  * Calls a method get partList for which IsMRONeutralType constant value is true i.e MRO parts .
  * @param {Object} partList partList with both mro and non-mro type of parts
  * @return {Promise} deferred promise
  */
 let getMROObjects = function( partList ) {
     let deferred = AwPromiseService.instance.defer();

     let inputArray = [];
     _.forEach( partList, function( part ) {
         let input = { typeName: part.type, constantName: 'IsMRONeutralType' };
         inputArray.push( input );
     } );
     const input = {
         keys: inputArray
     };
     soaSvc.post( 'BusinessModeler-2007-06-Constants', 'getTypeConstantValues', input ).then( function( response ) {
         let constantValues = _.values( response.constantValues );
         let nonMROTypes = [];
         _.forEach( constantValues, function( constantValue ) {
             if ( constantValue.value === 'false' ) {
                 if ( !nonMROTypes.includes( constantValue.key.typeName ) ) { nonMROTypes.push( constantValue.key.typeName ); }
             }
         } );

         let mroPartListInput = [];
         _.forEach( partList, function( part ) {
             if ( !nonMROTypes.includes( part.type ) ) { mroPartListInput.push( part ); }
         } );
         appCtxSvc.updateCtx( 'MROPartListInput', mroPartListInput );
         eventBus.publish( 'ssp0Sbom.loadPLF' );
         deferred.resolve();
     }, function( reason ) {
         deferred.reject( reason );
     } );
     return deferred.promise;
 };


 /**
  * Calls a method get partList and partRevisionList using getProperties SOA and vnos.
  * @param {Object} vmos selectd view model object
  * @return {Promise} deferred promise
  */
 export let getPartList = function( vmos ) {
     let deferred = AwPromiseService.instance.defer();
     let trgVmosToUpdate = vmos;
     let partList = [];
     let partRevisionList = [];
     let itr = 0;

     _.forEach( trgVmosToUpdate, function( trgVmoToUpdate ) {
         let cdmObject = cdm.getObject( trgVmoToUpdate.uid );
         if ( cdmObject !== null && cdmObject.props !== undefined && cdmObject.props.awb0UnderlyingObject !== undefined && cdmObject.props.awb0UnderlyingObject.dbValues !== undefined && cdmObject.props.awb0UnderlyingObject.dbValues[0] !== undefined ) {
             let partRevision = cdm.getObject( cdmObject.props.awb0UnderlyingObject.dbValues[0] );
             if ( partRevision ) {
                 partRevisionList.push( partRevision );
             }
         }
     } );

     const input =
     {
         objects: partRevisionList,
         attributes: [ 'items_tag' ]

     };
     soaSvc.post( 'Core-2006-03-DataManagement', 'getProperties', input ).then( function( response ) {
         if ( response && response.modelObjects ) {
             itr = 0;

             _.forEach( trgVmosToUpdate, function( trgVmoToUpdate ) {
                 let cdmObject = cdm.getObject( trgVmoToUpdate.uid );
                 if ( cdmObject !== null && cdmObject.props !== undefined && cdmObject.props.awb0UnderlyingObject !== undefined && cdmObject.props.awb0UnderlyingObject.dbValues !== undefined && cdmObject.props.awb0UnderlyingObject.dbValues[0] !== undefined ) {
                     let partRevision = cdm.getObject( cdmObject.props.awb0UnderlyingObject.dbValues[0] );
                     if ( partRevision && partRevision.props !== undefined && partRevision.props.items_tag !== undefined && partRevision.props.items_tag.dbValues[0] !== undefined && partRevision.props.items_tag.dbValues[0] !== undefined ) {
                         let part = cdm.getObject( partRevision.props.items_tag.dbValues[0] );
                         partList[itr++] = part;
                     }
                 }
             } );
         }
         appCtxSvc.updateCtx( 'PartRevisionList', partRevisionList );
         getMROObjects( partList );
         deferred.resolve();
     }, function( reason ) {
         deferred.reject( reason );
     } );

     return deferred.promise;
 };


 /**
  * getPLFPropertyValue
  * @param {Object} vmo selecetd view model object
  * @param {String} propertyFlag flag for the PLF property
  * @return {Object} Reference Object
  */
 let getPLFPropertyValue = function( vmo, propertyFlag ) {
     let valueUpdated = 0;
     let refObj = {};
     const mroPartList = appCtxSvc.getCtx( 'MROPartList' );
     const PLFList = appCtxSvc.getCtx( 'PLFList' );
     if ( vmo.uid && cdm.getObject( vmo.uid ) && cdm.getObject( vmo.uid ).props.awb0UnderlyingObject ) {
         let partRevision = cdm.getObject( cdm.getObject( vmo.uid ).props.awb0UnderlyingObject.dbValues[0] );
         if ( partRevision && partRevision.props.items_tag ) {
             let part = cdm.getObject( partRevision.props.items_tag.dbValues[0] );
             let PLF;

             if ( mroPartList && PLFList ) {
                 for ( let i = 0; i < mroPartList.length; i++ ) {
                     if ( mroPartList[i] === part ) {
                         PLF = PLFList[i];
                         break;
                     }
                 }
                 if ( PLF ) {
                     refObj.placid = PLF.uid;
                     _setPLFProps( vmo, propertyFlag, PLF, refObj );
                 } else {
                     let localTextBundle = localeService.getLoadedText( RESOURCE_MESSAGE );
                     refObj.placid = localTextBundle.noPLFProperty;
                     refObj.plfValue = localTextBundle.noPLFProperty;
                 }
                 valueUpdated = 1;
             }
         }
     }
     if ( valueUpdated === 1 ) {
         eventBus.publish( 'sbomTree.plTable.updated', { updatedObjects: [ vmo ] } );
     }
     return refObj;
 };

 let _setPLFProps = function( vmo, propertyFlag, PLF, refObj ) {
     switch ( propertyFlag ) {
         case 'traceableValueColumn':
             if ( PLF.props.isTraceable ) {
                 refObj.plfValue = PLF.props.isTraceable.uiValues[0];
                 traceableMap.set( vmo.uid, refObj );
             }
             break;
         case 'serializedValueColumn':
             if ( PLF.props.isSerialized ) {
                 refObj.plfValue = PLF.props.isSerialized.uiValues[0];
                 serializedMap.set( vmo.uid, refObj );
             }
             break;
         case 'lotValueColumn':
             if ( PLF.props.isLot ) {
                 refObj.plfValue = PLF.props.isLot.uiValues[0];
                 lotMap.set( vmo.uid, refObj );
             }
             break;
         case 'pQuantityValueColumn':
             if ( PLF.props.preserveQuantity ) {
                 refObj.plfValue = PLF.props.preserveQuantity.uiValues[0];
                 pQuantityMap.set( vmo.uid, refObj );
             }
             break;
         case 'rotableValueColumn':
             if ( PLF.props.isRotable ) {
                 refObj.plfValue = PLF.props.isRotable.uiValues[0];
                 rotableMap.set( vmo.uid, refObj );
             }
             break;
         case 'consumableValueColumn':
             if ( PLF.props.isConsumable ) {
                 refObj.plfValue = PLF.props.isConsumable.uiValues[0];
                 consumableMap.set( vmo.uid, refObj );
             }
             break;
         case 'assetValueColumn':
             if ( PLF.props.sse0isAsset ) {
                 refObj.plfValue = PLF.props.sse0isAsset.uiValues[0];
                 assetMap.set( vmo.uid, refObj );
             }
             break;
     }
 };

 /**
  * Calls methods to get PLF property value as cell text element. Appends it to the container element.
  *
  * @param {Object} vmo the vmo for the cell
  * @param {DOMElement} containerElement containerElement
  * @param {Object} columnName the column associated with the cell
  *
  */
 export let getPLFValueRenderer = function( vmo, containerElement, columnName ) {
     let refobj = {};

     const partRevisionList = appCtxSvc.getCtx( 'PartRevisionList' );
     if ( partRevisionList ) {
         switch ( columnName ) {
             case 'traceableValueColumn':
                 if ( traceableMap.has( vmo.uid ) && !appCtxSvc.getCtx( 'editInProgress' ) ) {
                     refobj = traceableMap.get( vmo.uid );
                 } else {
                     refobj = getPLFPropertyValue( vmo, 'traceableValueColumn' );
                 }
                 break;
             case 'serializedValueColumn':
                 if ( serializedMap.has( vmo.uid ) && !appCtxSvc.getCtx( 'editInProgress' ) ) {
                     refobj = serializedMap.get( vmo.uid );
                 } else {
                     refobj = getPLFPropertyValue( vmo, 'serializedValueColumn' );
                 }
                 break;
             case 'lotValueColumn':
                 if ( lotMap.has( vmo.uid ) && !appCtxSvc.getCtx( 'editInProgress' ) ) {
                     refobj = lotMap.get( vmo.uid );
                 } else {
                     refobj = getPLFPropertyValue( vmo, 'lotValueColumn' );
                 }
                 break;
             case 'pQuantityValueColumn':
                 if ( pQuantityMap.has( vmo.uid ) && !appCtxSvc.getCtx( 'editInProgress' ) ) {
                     refobj = pQuantityMap.get( vmo.uid );
                 } else {
                     refobj = getPLFPropertyValue( vmo, 'pQuantityValueColumn' );
                 }
                 break;
             case 'rotableValueColumn':
                 if ( rotableMap.has( vmo.uid ) && !appCtxSvc.getCtx( 'editInProgress' ) ) {
                     refobj = rotableMap.get( vmo.uid );
                 } else {
                     refobj = getPLFPropertyValue( vmo, 'rotableValueColumn' );
                 }
                 break;
             case 'consumableValueColumn':
                 if ( consumableMap.has( vmo.uid ) && !appCtxSvc.getCtx( 'editInProgress' ) ) {
                     refobj = consumableMap.get( vmo.uid );
                 } else {
                     refobj = getPLFPropertyValue( vmo, 'consumableValueColumn' );
                 }
                 break;
             case 'assetValueColumn':
                 if ( assetMap.has( vmo.uid ) && !appCtxSvc.getCtx( 'editInProgress' ) ) {
                     refobj = assetMap.get( vmo.uid );
                 } else {
                     refobj = getPLFPropertyValue( vmo, 'assetValueColumn' );
                 }
         }
         let iconElement = ssp0TableCellRenderer.getTextCellElement( refobj, containerElement, columnName );
         if ( iconElement !== null ) {
             containerElement.appendChild( iconElement );
         }
     }
 };

 export default exports = {
     getPLFValueRenderer,
     getPartList,
     getPLF
 };
