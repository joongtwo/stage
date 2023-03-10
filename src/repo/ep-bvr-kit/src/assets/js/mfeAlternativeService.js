// Copyright (c) 2022 Siemens

/**

 * @module js/mfeAlternativeService
 */
import _ from 'lodash';
import appCtxService from 'js/appCtxService';
import { constants as _epBvrConstants } from 'js/epBvrConstants';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import TypeUtils from 'js/utils/mfeTypeUtils';
import epLoadInputHelper from 'js/epLoadInputHelper';
import { constants as _epLoadConstants } from 'js/epLoadConstants';
import epLoadService from 'js/epLoadService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import _soaService from 'soa/kernel/soaService';
import epNavigationService from 'js/epNavigationService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import AwPromiseService from 'js/awPromiseService';

const ALTERNATIVE_UID = 'AlternativeUID';
let objectToNavigate;
const NAVIGATE_TO_NEWTAB = 'newTab';
const EP_SCOPE_OBJECT = 'ep.scopeObject';
const EP_PAGE_CONTEXT = 'epPageContext';

/**
 * createPartialAlternative: for creating partial alternative
 * @param {Object} data view model data
 * @param {Boolean} openOnActionBox boolean to open in a new tab
 */
function createPartialAlternative( data, openOnActionBox ) {
    let saveInputWriter = saveInputWriterService.get();
    let object = appCtxService.getCtx( EP_SCOPE_OBJECT );
    let inputObj = {
        newPlantBOPName: data.plantBOPName.dbValue,
        newPackageName: data.packageName.dbValue,
        newDescription: data.description.dbValue,
        isPartial: true,
        cloneAlternative: isCloneAlternative()
    };
    saveInputWriter.addAlternativeInput( object, inputObj, ALTERNATIVE_UID );
    epSaveService.saveChanges( saveInputWriter, false, [ object ] ).then( function( result ) {
        let ccuid = null;
        for( let index in result.saveResults ) {
            if( result.saveResults[ index ].clientID === ALTERNATIVE_UID ) {
                ccuid = result.saveResults[ index ].saveResultObject.uid;
            }
        }

        objectToNavigate = cdm.getObject( ccuid );
        eventBus.publish( 'AlternativePopupClose' );
        if( openOnActionBox ) {
            epNavigationService.navigteToSameStateWithDifferentConfiguration( objectToNavigate.uid, NAVIGATE_TO_NEWTAB );
        }else{
            messagingService.showInfo(  data.i18n.alternativeCreated.replace( '{0}', `"${data.currentNode}/${data.packageName.dbValue}"` ) );
        }
    } );
}

/**
 * createAlternative: for creating alternative
 * @param {Object} data the view model data
 */
function createAlternative( data ) {
    //disable create button

    let pageContext = appCtxService.getCtx( EP_PAGE_CONTEXT );

    let loadedObject = pageContext.loadedObject;
    let openOnActionBox = data.openOnActionBoxCreate.dbValue;

    if( pageContext.collaborationContext.props[ _epBvrConstants.MBC_MASTER_CC ].dbValues[ 0 ] ) {
        openOnActionBox = data.openOnActionBoxClone.dbValue;
    }
    if( TypeUtils.isOfType( loadedObject, _epBvrConstants.MFG_PLANT_BOP ) ) {
        createWorkPackageAlternative( data, openOnActionBox );
    } else {
        createPartialAlternative( data, openOnActionBox );
    }
}

/**
 *createWorkPackageAlternative : for creating full alternative
 * @param { Object } data view model data
 * @param { Boolean } openOnActionBox boolean to open in a new tab
 */
function createWorkPackageAlternative( data, openOnActionBox ) {
    let modelObjs = appCtxService.getCtx( EP_PAGE_CONTEXT );

    let objectType = getObjectType( modelObjs );

    _soaService.post( 'Core-2006-03-DataManagement', 'generateItemIdsAndInitialRevisionIds', {
        input: [ {
            item: null,
            itemType: objectType,
            count: 1
        } ]
    } ).then( function( response ) {
        if( response.outputItemIdsAndInitialRevisionIds[ 0 ][ 0 ] ) {
            createAlternativeWorkPackage( data, openOnActionBox );
        }
    } );
}

/**
 * isCloneAlternative
 * @returns {Boolean} true is the currect WP is an alternative, false otherwise
 */
function isCloneAlternative() {
    let modelObjs = appCtxService.getCtx( EP_PAGE_CONTEXT );
    return modelObjs.collaborationContext.props[ _epBvrConstants.MBC_MASTER_CC ].dbValues[ 0 ];
}

/**
 *  We need to create the same type of plant BOP as that in the master CC.
 * Thus need to know what type of object was used for creating plant BOP in master CC.
 * @param {Object} data view model data
 * @param { boolean } openOnActionBox boolean to open in a new tab
 */
function createAlternativeWorkPackage( data, openOnActionBox ) {
    //SOA Call
    let saveInputWriter = saveInputWriterService.get();
    let object = appCtxService.getCtx( EP_SCOPE_OBJECT );
    let inputObj = {
        newPlantBOPName: data.plantBOPName.dbValue,
        newPackageName: data.packageName.dbValue,
        newDescription: data.description.dbValue,
        isPartial: false,
        cloneAlternative: isCloneAlternative()
    };

    saveInputWriter.addAlternativeInput( object, inputObj, ALTERNATIVE_UID );

    epSaveService.saveChanges( saveInputWriter, false, [ object ] ).then( function( result ) {
        let ccuid = null;
        for( let index in result.saveResults ) {
            if( result.saveResults[ index ].clientID === ALTERNATIVE_UID ) {
                ccuid = result.saveResults[ index ].saveResultObject.uid;
            }
        }

        objectToNavigate = cdm.getObject( ccuid );
        eventBus.publish( 'AlternativePopupClose' );
        if( openOnActionBox ) {
            epNavigationService.navigateToManagePage( objectToNavigate, NAVIGATE_TO_NEWTAB );
        }
    } );
}

/**
 * Go to master collaboration context structure
 */
function goToMaster() {
    const object = appCtxService.getCtx( EP_SCOPE_OBJECT );
    let loadTypeInputs = epLoadInputHelper
        .getLoadTypeInputs( _epLoadConstants.ALTERNATIVE_WP_INFO, object.uid );
    return epLoadService
        .loadObject( loadTypeInputs, false )
        .then(
            function( result ) {
                //TODO
                const alternativeWP_uid = result.relatedObjectsMap[ object.uid ].additionalPropertiesMap2.alternativeWPs[ 0 ];
                let loadTypeInputs2 = epLoadInputHelper.getLoadTypeInputs(
                    _epLoadConstants.OBJ_IN_RELATED_PACKAGE, object.uid, null, alternativeWP_uid );
                return epLoadService
                    .loadObject( loadTypeInputs2, false )
                    .then(
                        function( result2 ) {
                            const params = {
                                uid: result2.relatedObjectsMap[ object.uid ].additionalPropertiesMap2.objectInRelatedPackage[ 0 ],
                                mcn: null
                            };
                            epNavigationService.navigteToSameStateWithDifferentConfiguration( params.uid, NAVIGATE_TO_NEWTAB );
                        } );
            } );
}

/**
 * Search for partial alternatives
 * @returns {Promise} load promise of partial alternatives
 */
function searchPartialAlternative() {
    const awPromise = AwPromiseService.instance;
    const resource = localeService.getLoadedText( 'AlternativeMessages' );
    let listOfAltCCs = [];
    const currentObject = appCtxService.getCtx( EP_SCOPE_OBJECT );
    const loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( _epLoadConstants.ALTERNATIVE_WP_INFO,
        currentObject.uid );

    return awPromise.resolve( epLoadService.loadObject( loadTypeInputs, false ).then(
        function( output ) {
            const ccMap = output.loadedObjectsMap;
            for( let key in ccMap ) {
                for( const element of ccMap[ key ] ) {
                    listOfAltCCs.push( element );
                }
            }
            if( listOfAltCCs.length === 0 ) {
                messagingService.showInfo( resource.noAlternativeMessage
                    .format( currentObject.props.object_string.dbValues[ 0 ] ) );
            } else {
                appCtxService.registerCtx( 'allAltCCsList', listOfAltCCs );
            }
        } ) );
}

/**
 * @param  {Objects} modelObjs get object
 * @return {String} Object type
 */
function getObjectType( modelObjs ) {
    let processStruct = cdm.getObject( modelObjs.processStructure.uid );
    let objectProps = processStruct.props[ _epBvrConstants.BL_ITEM_FND_MFKINFO ].dbValues[ 0 ];
    let propArr = objectProps.split( ',' );
    let i;
    for( i in propArr ) {
        if( _.includes( propArr[ i ], 'object_type' ) ) {
            break;
        }
    }
    let propValArr = propArr[ i ].split( '=' );
    return propValArr[ 1 ];
}

export default {
    createAlternative,
    goToMaster,
    searchPartialAlternative
};
