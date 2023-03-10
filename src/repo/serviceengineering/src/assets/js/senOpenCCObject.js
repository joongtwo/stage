// Copyright (c) 2022 Siemens

/**
 * @module js/senOpenCCObject
 */
import soaSvc from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import occmgmtGetOccsResponseService from 'js/occmgmtGetOccsResponseService';
import navigationSvc from 'js/navigationService';
 import cdm from 'soa/kernel/clientDataModel';

let exports = {};

/**
  * call get occurance and redirect to show Object location if mro_serv_egg license not present
  * @param cc_uid CC Object Uid
  * @param cc_uid CC Object Type
  * @param navigateIn navigate Type
  */
export let openCCObject = function( cc_uid, cc_type, navigateIn ) {
    var navigationParams = {};
    var action = {
        actionType: 'Navigate',
        navigateIn: navigateIn
    };
     if(cc_type==="Awp0XRTObjectSetRow"){
        cc_uid = cdm.getObject( cc_uid ).props.awp0Target.dbValues[0];

     }
    var soaInput = getOcc3SoaInput( cc_uid, cc_type );

    return soaSvc.postUnchecked( 'Internal-ActiveWorkspaceBom-2022-06-OccurrenceManagement', 'getOccurrences4',
        soaInput ).then( function( response ) {
        var deferred = AwPromiseService.instance.defer();

        if ( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
            occmgmtGetOccsResponseService.processPartialErrors( response );
            navigationParams.uid = cc_uid;
            action.navigateTo = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
            navigationSvc.navigate( action, navigationParams );
        } else {
            navigationParams.cc_uid = cc_uid;
            action.navigateTo = 'ServiceEngineering';
            navigationSvc.navigate( action, navigationParams );
        }
        deferred.resolve( response );
        return deferred.promise;
    }, function( error ) {
        occmgmtGetOccsResponseService.processFailedIndexError( error );
        throw soaSvc.createError( error );
    } );
};

/**
   *Create getOccurenses3 SOA Input
   * @param cc_uid CC Object Uid
   * @param cc_uid CC Object Type
   */
let getOcc3SoaInput = function( cc_uid, cc_type ) {
    return {
        inputData: {
            product: {
                type: cc_type,
                uid: cc_uid
            },
            config: {
                effectivityDate: '0001-01-01T00:00:00',
                unitNo: -1
            },
            cursor: {},
            focusOccurrenceInput: {},
            filter: {},
            requestPref: {
                openWPMode: [ 'sbom_only' ]
            },
            sortCriteria: {}
        }
    };
};

export default exports = {
    openCCObject
};

