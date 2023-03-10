// Copyright (c) 2022 Siemens

/**
 * @module js/occMgmtDuplicateViewService
 */
 import AwStateService from 'js/awStateService';
 import dataManagementService from 'soa/dataManagementService';
 import clientDataModel from 'soa/kernel/clientDataModel';
 import viewModelObjectSvc from 'js/viewModelObjectService';
 import appCtxSvc from 'js/appCtxService';
 import AwPromiseService from 'js/awPromiseService';
 import policySvc from 'soa/kernel/propertyPolicyService';
 import occMgmtDuplicateCellService from 'js/occMgmtDuplicateCellService';
 import occmgmtPropertyPolicyService from 'js/occmgmtPropertyPolicyService';
 import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
 import occmgmtTreeTableDataService from 'js/occmgmtTreeTableDataService';
 import occmgmtUpdatePwaDisplayService from 'js/occmgmtUpdatePwaDisplayService';
 import aceExpandBelowService from 'js/aceExpandBelowService';
 import aceStructureConfigurationService from 'js/aceStructureConfigurationService';
 import backgroundWorkingCtxTimer from 'js/backgroundWorkingContextTimer';
 import backgroundWorkingCtxSvc from 'js/backgroundWorkingContextService';
 import occMgmtDuplicateActionService from 'js/occMgmtDuplicateActionService';
 import localeService from 'js/localeService';
 import cdmService from 'soa/kernel/clientDataModel';
 import dateEffConfigration from 'js/dateEffectivityConfigurationService';
 
 let exports = {};
 
 /** Policy ID of required loaded objects */
 let _policyId = null;
 
 export const initializeOccMgmtDuplicateView = ( subPanelContext ) => {
     let defer = AwPromiseService.instance.defer();
     let contextKey = subPanelContext._duplicateLocation.contextKey;
 
     let stateParams = AwStateService.instance.params;
     _registerContext( subPanelContext._duplicateLocation, stateParams );
     _registerAceActiveContext( contextKey );
     //ensure the required objects are loaded
     _policyId = registerPolicy();
     let uidsForLoadObject = [ stateParams.uid, stateParams.pci_uid, stateParams.t_uid ];
     dataManagementService.loadObjects( uidsForLoadObject ).then( function() {
         let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( clientDataModel.getObject( uidsForLoadObject[ 0 ] ), null );
         let taskTitle = '';
         if( vmo.props && vmo.props.object_string ) {
             taskTitle = vmo.props.object_string.uiValues[ 0 ];
         }
         appCtxSvc.updatePartialCtx( 'occmgmtContext.taskTitle', taskTitle );
         defer.resolve( [ vmo ] );
     } );
     initializeOccMgmtServices( contextKey );
     return defer.promise;
 };
 
 export const initializeOccContext = ( data ) => {
     let stateParams = AwStateService.instance.params;
     let occContext = data.declViewModelJson.data.occContext.initialValues;
     occContext.currentState = {
         uid: stateParams.uid,
         pci_uid: stateParams.pci_uid,
         t_uid: stateParams.t_uid
     };
     let duplicateConfigParams = appCtxSvc.getCtx( 'duplicateConfigParams' );
     if( duplicateConfigParams ) {
         occContext.configContext = {
             r_uid: duplicateConfigParams.currentRevRule,
             de: duplicateConfigParams.effDate,
             ei_uid: duplicateConfigParams.effEndItem,
             ue: duplicateConfigParams.effUnitNo,
             eg_uids: duplicateConfigParams.effectivityGroups,
             startDate: duplicateConfigParams.startEffDates,
             fromUnit: duplicateConfigParams.startEffUnits,
             endDate: duplicateConfigParams.endEffDates,
             toUnit: duplicateConfigParams.endEffUnits,
             var_uid: duplicateConfigParams.variantRule,
             packSimilarElements: duplicateConfigParams.packSimilarElements
         };
     }
     occContext.cellRenderers = [ occMgmtDuplicateCellService._duplicateEditCellRender, occMgmtDuplicateCellService._duplicateNonEditCellRender ];
     return {
         occContext: occContext ? occContext : data.atomicDataRef.occContext.getAtomicData()
     };
 };
 export const initializeOccMgmtServices = ( contextKey ) => {
     occMgmtStateHandler.initializeOccMgmtStateHandler();
     occMgmtDuplicateActionService.initialize( contextKey );
     occmgmtUpdatePwaDisplayService.initialize( contextKey );
     occmgmtTreeTableDataService.initialize();
     aceStructureConfigurationService.initialize();
     occmgmtPropertyPolicyService.registerPropertyPolicy();
     aceExpandBelowService.initialize();
     backgroundWorkingCtxTimer.initialize( contextKey );
     backgroundWorkingCtxSvc.initialize( contextKey );
 };
 
 let destroyOccMgmtServices = ( subPanelContext ) => {
     let contextKey = subPanelContext.occContext.viewKey;
     occMgmtStateHandler.destroyOccMgmtStateHandler( contextKey );
     occmgmtUpdatePwaDisplayService.destroy( contextKey );
     occmgmtTreeTableDataService.destroy( contextKey );
     aceStructureConfigurationService.destroy( contextKey );
     occmgmtPropertyPolicyService.unRegisterPropertyPolicy();
     aceExpandBelowService.destroy( contextKey );
     backgroundWorkingCtxTimer.reset();
     backgroundWorkingCtxSvc.reset( subPanelContext );
 };
 
 let _registerContext = function( provider, stateParams ) {
     let requestPref = {
         savedSessionMode: 'ignore'
     };
     appCtxSvc.registerCtx( 'requestPref', requestPref );
     appCtxSvc.registerCtx( provider.contextKey, {
         currentState: {
             uid: stateParams.uid,
             pci_uid: stateParams.pci_uid,
             t_uid: stateParams.t_uid
         },
         pwaSelectionModel: {},
         previousState: {},
         requestPref: requestPref,
         readOnlyFeatures: {},
         urlParams: provider.urlParams,
         expansionCriteria: {},
         isRowSelected: false,
         supportedFeatures: [],
         runInBackgroundValue: true,
         transientRequestPref: {},
         persistentRequestPref: {
             showExplodedLines: false
         }
     } );
 };
 
 /**
  * Register ACE active context
  *
  * @param {string} contextKey - context key
  */
 let _registerAceActiveContext = function( contextKey ) {
     appCtxSvc.registerCtx( 'aceActiveContext', {
         key: contextKey,
         context: appCtxSvc.ctx[ contextKey ]
     } );
 };
 
 // Register the policy before SOA call
 let registerPolicy = function() {
     return policySvc.register( {
         types: [ {
             name: 'Awb0ConditionalElement',
             properties: [ {
                 name: 'awb0ArchetypeRevId'
             } ]
         } ]
     } );
 };
 
 export const destroyOccmgmtDuplicateView = ( subPanelContext ) => {
     destroyOccMgmtServices( subPanelContext );
     appCtxSvc.unRegisterCtx( 'taskbarfullscreen' );
     appCtxSvc.unRegisterCtx( 'duplicateConfigParams' );
     appCtxSvc.unRegisterCtx( 'aceActiveContext' );
     // Unregister the required objects policy
     if( _policyId ) {
         policySvc.unregister( _policyId );
     }
 };
 
 export const setConfigOnContext = () => {
     let defer = AwPromiseService.instance.defer();
     let currProductContextInfo = appCtxSvc.getCtx( 'occmgmtContext' ).productContextInfo;
     if( currProductContextInfo ) {
         let currentRevRule = currProductContextInfo.props.awb0CurrentRevRule.dbValues[ 0 ];
         let effDate = currProductContextInfo.props.awb0EffDate.dbValues[ 0 ];
         let effEndItem = currProductContextInfo.props.awb0EffEndItem.dbValues[ 0 ];
         let effUnitNo = currProductContextInfo.props.awb0EffUnitNo.dbValues[ 0 ];
         let effectivityGroups = currProductContextInfo.props.awb0EffectivityGroups.dbValues;
         let startEffDates = currProductContextInfo.props.awb0StartEffDates.dbValues[ 0 ];
         let startEffUnits = currProductContextInfo.props.awb0StartEffUnits.dbValues[ 0 ];
         let endEffDates = currProductContextInfo.props.awb0EndEffDates.dbValues[ 0 ];
         let endEffUnits = currProductContextInfo.props.awb0EndEffUnits.dbValues[ 0 ];
         let variantRule = currProductContextInfo.props.awb0CurrentVariantRule.dbValues[ 0 ];
         let packSimilarElement = currProductContextInfo.props.awb0PackSimilarElements.dbValues[ 0 ];
 
         let _configParams = {
             currentRevRule: currentRevRule,
             effDate: effDate,
             effEndItem: effEndItem,
             effUnitNo: effUnitNo,
             effectivityGroups: effectivityGroups,
             startEffDates: startEffDates,
             startEffUnits: startEffUnits,
             endEffDates: endEffDates,
             endEffUnits: endEffUnits,
             variantRule: variantRule,
             packSimilarElements: packSimilarElement === '1'
         };
         appCtxSvc.updateCtx( 'duplicateConfigParams', _configParams );
     }
     return defer.resolve();
 };
 
 /**
  * This method update chip labels when props loaded event triggeres
  */
 export let updateChipsOnPropsLoaded = function() {
     let occMgmtDuplicateResource = 'OccMgmtDuplicateConstants';
     let occMgmtDuplicateBundle = localeService.getLoadedText( occMgmtDuplicateResource );
     let occMgmtResource = 'OccurrenceManagementConstants';
     let occMgmtBundle = localeService.getLoadedText( occMgmtResource );
     
     let currProductContextInfo = appCtxSvc.getCtx( 'occmgmtContext' ).productContextInfo;
     let occMgmtDuplicateChips = [];
     
     let dateEffArr = [];
     let unitEffArr = [];
     let effectivityGroups = currProductContextInfo.props.awb0EffectivityGroups;
 
     for(var i=0; effectivityGroups && i < effectivityGroups.dbValues.length; i++){
         
         let cdmObj = cdmService.getObject(currProductContextInfo.props.awb0EffectivityGroups.dbValues[i]);
         let effString = cdmObj.props.awp0CellProperties.dbValues[1];
         if(dateEffConfigration.isDateEffectivity(effString)) {
             dateEffArr.push(cdmObj.props.object_name.uiValues[ 0 ]);
         } else {
             unitEffArr.push(cdmObj.props.object_name.uiValues[ 0 ]);
         }
     }
 
     if( currProductContextInfo && currProductContextInfo.props ) {
         //Revison Rule
         let revRule = currProductContextInfo.props.awb0CurrentRevRule;
         if( revRule.uiValues[ 0 ] ) {
             let revisionChipLabel = occMgmtDuplicateBundle.OccMgmtDuplicateRevisionChip;
             let currentRevRule = revRule.uiValues[ 0 ];
             revisionChipLabel = revisionChipLabel.replace( '{0}', currentRevRule );
             occMgmtDuplicateChips.push( getChip( revisionChipLabel ) );
         }
         //Date Effectivity
         let dateChipLabel = occMgmtDuplicateBundle.OccMgmtDuplicateDateChip;
         let currentEffDate = occMgmtBundle.occurrenceManagementTodayTitle;
         let effDate = currProductContextInfo.props.awb0EffDate;
         if( dateEffArr.length > 0 ) {
             currentEffDate = dateEffArr[0];
         }else if( effDate.uiValues[ 0 ] ) {
             currentEffDate = effDate.uiValues[ 0 ];
         }
         dateChipLabel = dateChipLabel.replace( '{0}', currentEffDate );
         occMgmtDuplicateChips.push( getChip( dateChipLabel ) );
         
         //Unit
         let unit = currProductContextInfo.props.awb0EffUnitNo;
         let unitChipLabel = occMgmtDuplicateBundle.OccMgmtDuplicateUnitChip;
         if ( unitEffArr.length > 0 ) {
             unitChipLabel = unitChipLabel.replace('{0}', unitEffArr[0]);
             occMgmtDuplicateChips.push( getChip( unitChipLabel ) );
         } else if( unit.uiValues[ 0 ] ) {
             let currentUnit = unit.uiValues[ 0 ];
             unitChipLabel = unitChipLabel.replace( '{0}', currentUnit );
             occMgmtDuplicateChips.push( getChip( unitChipLabel ) );
         }
 
         //Variant Rule
         let variant = currProductContextInfo.props.awb0VariantRules;
         if( variant.uiValues[ 0 ] ) {
             let currentVariant = variant.uiValues[ 0 ];
             let variantChipLabel = occMgmtDuplicateBundle.OccMgmtDuplicateVariantChip;
             variantChipLabel = variantChipLabel.replace( '{0}', currentVariant );
             occMgmtDuplicateChips.push( getChip( variantChipLabel ) );
         } 
 
         //Arrangement TODO - We will expose it while doing story LCS-650610 
         // let arrangement = currProductContextInfo.props.awb0AppliedArrangement;
         // if( arrangement.uiValues[ 0 ] ) {
         //     let currentArrangement = arrangement.uiValues[ 0 ];
         //     let variantArrangementLabel = occMgmtDuplicateBundle.OccMgmtDuplicateArrangementChip;
         //     variantArrangementLabel = variantArrangementLabel.replace( '{0}', currentArrangement );
         //     occMgmtDuplicateChips.push( getChip( variantArrangementLabel ) );
         // }
     }
     return occMgmtDuplicateChips;
 };

 /**
 * This method is for saveasandreplace panel 
 * to make replaceTextBox required .
 * @param {*} fields 
 * @param {*} fieldName 
 */ 
export let updateField = function( fields, fieldName ) {
    let fieldToUpdate = fields[ fieldName ];
    if( fields.withTextBox.value && fields.replaceTextBox.value === ""){
        fieldToUpdate.update( fields.replaceTextBox.value, { isRequired : true } );
    }
   
};
 
 let getChip = ( value ) => {
     return {
         chipType: 'STATIC',
         labelDisplayName: value
     };
 };
 
 export default exports = {
     initializeOccMgmtDuplicateView,
     initializeOccContext,
     initializeOccMgmtServices,
     destroyOccmgmtDuplicateView,
     setConfigOnContext,
     updateChipsOnPropsLoaded,
     updateField
 };
 