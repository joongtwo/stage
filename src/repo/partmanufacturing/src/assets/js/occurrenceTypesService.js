// Copyright (c) 2022 Siemens

/**
 * @module js/occurrenceTypesService
 */
import appCtxSvc from 'js/appCtxService';
import AwLovEdit from 'viewmodel/AwLovEditViewModel';
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';

var exports = {};

/**
  * Render function for AwLovEdit for Occ Type
  * @param {*} props context for render function interpolation
  * @returns {JSX.Element} react component
  */
export const occTypePickerRenderFunction = ( props ) => {
    const {  viewModel, ...prop } = props;

    let fielddata = { ...prop.fielddata };
    fielddata.hasLov = true;
    fielddata.dataProvider = viewModel.dataProviders.occTypesDataProvider;

    const passedProps = { ...prop,  fielddata };

    return (
        <AwLovEdit {...passedProps} ></AwLovEdit>
    );
};

/**
 * Loads occurrence types from server using SOA. Caches the occurrence types in Part Mfg context. 
 *
 * @param {Object} parentItemRev
 * @param {Object} sourceVMOs
 */
export let loadOccTypesInfo = function( parentItemRev, sourceVMOs ) {
    var deferred = AwPromiseService.instance.defer();

    var partMfgCtx = appCtxSvc.getCtx( 'PartMfg' );

    var sourceElements = [];

    var itemTypeOccTypesMap = partMfgCtx.itemTypeOccTypesMap;
    var itemTypeDefOccTypeMap = partMfgCtx.itemTypeDefOccTypeMap;

    // Check if map contains all input source object types and create list accordingly

    _.forEach( sourceVMOs, function( sourceVMO ) {
        // It is found that awb0UnderlyingObjectType is not loaded for objects selected from Pallete and Search tabs
        // So it is better to get type from awb0UnderlyingObject 
        var awb0UnderlyingObj = cdm.getObject( sourceVMO.props.awb0UnderlyingObject.dbValues[0] );

        var awb0UnderlyingType = awb0UnderlyingObj ? awb0UnderlyingObj.type : undefined;
        if( !awb0UnderlyingType ) {
            awb0UnderlyingType = sourceVMO.props.awb0UnderlyingObjectType ? sourceVMO.props.awb0UnderlyingObjectType.dbValues[0] : undefined;
        }
        if( awb0UnderlyingType ) {
            var occTypeNames = itemTypeOccTypesMap[awb0UnderlyingType];

            var defOccType = itemTypeDefOccTypeMap[awb0UnderlyingType];

            if( !occTypeNames || occTypeNames.length === 0 || !defOccType ) {
                sourceElements.push( cdm.getObject( sourceVMO.uid ) );
            }
        }
    } );

    // Call the SOA only if map is not already populated for all source objects

    if( sourceElements.length > 0 ) {
        var requestPref = {};
        requestPref.useMEDisplayOccurrenceTypePref = [ 'true' ];
        var soaInput = {
            inputData: {
                parentObject: parentItemRev,
                sourceObjects: sourceElements,
                requestPref: requestPref
            }
        };

        return soaSvc.postUnchecked( 'Internal-ActiveWorkspaceBom-2020-12-OccurrenceManagement', 'getAllowedOccurrenceTypes', soaInput ).then( function( response ) {
            if ( !_.isEmpty( response.occTypeInfo.srcObjectOccTypesMap ) ) {
                var srcObjectOccTypesMap = new Map();
                var srcObjectDefOccTypeMap = new Map();
                for ( var indx = 0; indx < response.occTypeInfo.srcObjectOccTypesMap[0].length; indx++ ) {
                    var sourceUid = response.occTypeInfo.srcObjectOccTypesMap[0][indx].uid;
                    var occTypeNamesValue = response.occTypeInfo.srcObjectOccTypesMap[1][indx];
                    srcObjectOccTypesMap.set( sourceUid, occTypeNamesValue );
                }

                for ( var indy = 0; indy < response.occTypeInfo.srcObjectDefaultOccTypeMap[0].length; indy++ ) {
                    var sourceUid = response.occTypeInfo.srcObjectDefaultOccTypeMap[0][indy].uid;
                    var defOccTypeName = response.occTypeInfo.srcObjectDefaultOccTypeMap[1][indy];
                    srcObjectDefOccTypeMap.set( sourceUid, defOccTypeName );
                }

                _.forEach( sourceElements, function( sourceElem ) {
                    // It is found that awb0UnderlyingObjectType is not loaded for objects selected from Pallete and Search tabs
                    // So it is better to get type using awb0UnderlyingObject 
                    var awb0UnderlyingObj = cdm.getObject( sourceElem.props.awb0UnderlyingObject.dbValues[0] );
                    var awb0UnderlyingType = awb0UnderlyingObj.type;
                    var occTypeNames = srcObjectOccTypesMap.get( sourceElem.uid );
                    var defOccType = srcObjectDefOccTypeMap.get( sourceElem.uid );
                    itemTypeOccTypesMap[awb0UnderlyingType] = occTypeNames;
                    itemTypeDefOccTypeMap[awb0UnderlyingType] = defOccType;
                } );
                appCtxSvc.updatePartialCtx( 'PartMfg.itemTypeOccTypesMap', itemTypeOccTypesMap );
                appCtxSvc.updatePartialCtx( 'PartMfg.itemTypeDefOccTypeMap', itemTypeDefOccTypeMap );
            }
        }, function( error ) {
            throw soaSvc.createError( error );
        } );
    }
    deferred.resolve();
    return deferred.promise;
};

/**
 * Loads occurrence types in the dropdown of the table cell. 
 *
 * @param {Object} selectedRes
 */
export let loadOccTypes = function( selectedRes ) {
    var partMfgCtx = appCtxSvc.getCtx( 'PartMfg' );

    var underlyingObjType = selectedRes.props.awb0UnderlyingObjectType.dbValues[0];

    var occTypeNames = partMfgCtx.itemTypeOccTypesMap[underlyingObjType];

    var lovEntries = [];
    if( occTypeNames ) {
        for ( var idx = 0; idx < occTypeNames.length; idx++ ) {
            var uid = 'occtype' + idx;
            var lovEntry = {
                propInternalValue: occTypeNames[idx].internalName,
                propDisplayValue: occTypeNames[idx].displayName,
                propDisplayDescription: '',
                sel: selectedRes.props.awb0OccType.uiValues[0] === occTypeNames[idx].displayName
            };
            lovEntries.push( lovEntry );
        }
    }
    return {
        searchResults : lovEntries,
        moreValuesExist : false
    };
};

/**
 * Occurrence Type service
 */
export default exports = {
    occTypePickerRenderFunction,
    loadOccTypesInfo,
    loadOccTypes
};
