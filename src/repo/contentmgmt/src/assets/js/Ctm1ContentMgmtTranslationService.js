// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Ctm1ContentMgmtTranslationService
 */
import cdm from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';
import dateTimeService from 'js/dateTimeService';
import appCtxService from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import notifySvc from 'js/NotyModule';
import eventBus from 'js/eventBus';
import localeSvc from 'js/localeService';

var exports = {};

var _localizedText = {};

export let createTranslationDelivery = function( data ) {
    // Add the checked languages
    var langRow = [];

    for( var i = 0; i < data.language.length; i++ ) {
        if( data.language[ i ].dbValue === true || data.language[ i ].displayValues[ 0 ].toUpperCase() === 'TRUE' ) {
            langRow.push( { languageRef: data.language[ i ].obj } );
        }
    }

    // Add the options
    var includeGraphics = false;
    if( data.includeGraphics.dbValue === true || data.includeGraphics.displayValues[ 0 ].toUpperCase() === 'TRUE' ) {
        includeGraphics = true;
    }

    var includeSupportingData = false;
    if( data.includeSupportingData.dbValue === true || data.includeSupportingData.displayValues[ 0 ].toUpperCase() === 'TRUE' ) {
        includeSupportingData = true;
    }

    var includePublishedContent = false;
    if( data.includePublishedContent.dbValue === true || data.includePublishedContent.displayValues[ 0 ].toUpperCase() === 'TRUE' ) {
        includePublishedContent = true;
    }

    // Add if it is using a composed or decomposed output
    var deliverComposedTopic = false;
    if( data.deliverComposed.dbValue === true || data.deliverComposed.displayValues[ 0 ].toUpperCase() === 'TRUE' ) {
        deliverComposedTopic = true;
    }

    var deliverDecomposedTopic = false;
    if( data.deliverDecomposed.dbValue === true || data.deliverDecomposed.displayValues[ 0 ].toUpperCase() === 'TRUE' ) {
        deliverDecomposedTopic = true;
    }

    if( deliverDecomposedTopic === true ) {
        var deliverOutOfSync = false;
        if( data.deliverOutOfSync.dbValue === true || data.deliverOutOfSync.displayValues[ 0 ].toUpperCase() === 'TRUE' ) {
            deliverOutOfSync = true;
        }

        var deliverOutForTrans = false;
        if( data.deliverTopicsOutForTransl.dbValue === true || data.deliverTopicsOutForTransl.displayValues[ 0 ].toUpperCase() === 'TRUE' ) {
            deliverOutForTrans = true;
        }
    }

    // Setup the input
    var inputData = {
        input: [ {
            clientId: 'export',
            translationOrderRev: appCtxService.ctx.selected,
            booleanProps: {
                'Include Graphics': Boolean( includeGraphics ),
                'Include Supporting Data': Boolean( includeSupportingData ),
                'Include Published Content': Boolean( includePublishedContent ),
                'Deliver Composed Topic': Boolean( deliverComposedTopic ),
                'Deliver Decomposed Topic': Boolean( deliverDecomposedTopic ),
                'Deliver Only Out of Sync': Boolean( deliverOutOfSync ),
                'Deliver Out for Trans': Boolean( deliverOutForTrans )
            },
            languageRow: langRow
        } ]
    };

    // Call SOA
    var promise = soaSvc.postUnchecked( 'ContMgmtBase-2011-06-ContentManagement', 'prepareTranslationDelivery', inputData );
    promise.then( function( response ) {
        var eventData = { source: 'toolAndInfoPanel' };
        eventBus.publish( 'complete', eventData );

        eventBus.publish( 'cdm.relatedModified', {
            relatedModified: [ appCtxService.ctx.selected ]
        } );

        if( _localizedText.translationOrderCreated ) {
            var message = _localizedText.translationOrderCreated.replace( '{0}', response.output[ 0 ].tranlationDeliveryRev.props.object_name.uiValues[ 0 ] );
            message = message.replace( '{1}', appCtxService.ctx.selected.props.object_name.uiValues[ 0 ] );

            notifySvc.showInfo( message );
        }
    } );
};

export let updateCreateButton = function( data ) {
    var langSelected = 'false';

    for( var i = 0; i < data.language.length; i++ ) {
        if( data.language[ i ].dbValue === true || data.language[ i ].displayValues[ 0 ].toUpperCase() === 'TRUE' ) {
            langSelected = 'true';
            break;
        }
    }

    var isEnabled = 'false';

    if( data.deliverComposed.dbValue === true || data.deliverComposed.displayValues[ 0 ].toUpperCase() === 'TRUE' ||
        data.deliverDecomposed.dbValue === true || data.deliverDecomposed.displayValues[ 0 ].toUpperCase() === 'TRUE' && langSelected === 'true' ) {
        isEnabled = 'true';
    }

    return { createDeliveryVisible: isEnabled };
};

export let updateDeliverDecomposed = function( data ) {
    var isEditable = false;
    if( data.deliverDecomposed.dbValue === true || data.deliverDecomposed.displayValues[ 0 ].toUpperCase() === 'TRUE' ) {
        isEditable = true;
    }

    data.deliverOutOfSync.isEditable = isEditable;
    data.deliverOutOfSync.isEnabled = isEditable;

    data.deliverTopicsOutForTransl.isEditable = isEditable;
    data.deliverTopicsOutForTransl.isEnabled = isEditable;

    exports.updateCreateButton( data );
};

export let createTranslationOrder = function( data ) {
    var convDate = dateTimeService.formatUTC( data.dateDetails.dbValue );

    dmSvc.createObjects( [ {
        data: {
            boName: 'TranslationOrder',

            compoundCreateInput: {
                revision: [ {
                    boName: 'TranslationOrderRevision',
                    stringProps: {
                        orderTitle: data.orderTitle.dbValue,
                        orderDescription: data.orderDescription.dbValue,
                        object_name: data.orderName.dbValue
                    },
                    dateProps: {
                        requestDeliveryDate: convDate
                    },
                    tagProps: {
                        fnd0TrnslOfficeTagref: {
                            uid: data.translationOffice.dbValue,
                            type: 'TransltnOfficeRevision'
                        }
                    }
                } ]

            }
        }
    } ] ).then(
        function( response ) {
            var orderObj = null;

            for( var i = 0; i < response.output[ 0 ].objects.length; i++ ) {
                if( response.output[ 0 ].objects[ i ].type === 'TranslationOrderRevision' ) {
                    orderObj = response.output[ 0 ].objects[ i ];
                }
            }

            if( orderObj ) {
                var eventData = { source: 'toolAndInfoPanel' };
                eventBus.publish( 'complete', eventData );

                var createRelationsInput = [];

                // Relate translation order revision to topics
                for( var j = 0; j < appCtxService.ctx.mselected.length; j++ ) {
                    var selObj = appCtxService.ctx.mselected[ j ];

                    //if on content page, get underlying object
                    if( selObj.props.awb0UnderlyingObject ) {
                        selObj = cdm.getObject( selObj.props.awb0UnderlyingObject.dbValues[ 0 ] );
                    }

                    createRelationsInput.push( {
                        primaryObject: selObj,
                        secondaryObject: orderObj,
                        relationType: 'DC_TopicTranslOrderR',
                        clientId: 'AttachTranslationOrder'
                    } );
                }

                dmSvc.createRelations( createRelationsInput ).then(
                    function( relationsResponse ) {
                        eventBus.publish( 'cdm.relatedModified', {
                            relatedModified: [ selObj ]
                        } );

                        if( _localizedText.translationOrderCreated ) {
                            var message = _localizedText.translationOrderCreated.replace( '{0}', orderObj.props.object_name.uiValues[ 0 ] );
                            message = message.replace( '{1}', selObj.props.object_name.uiValues[ 0 ] );

                            notifySvc.showInfo( message );
                        }
                    } );
            }
        } );
};

var loadConfiguration = function() {
    localeSvc.getTextPromise( 'ContentMgmtMessages', true ).then(
        function( localTextBundle ) {
            _localizedText = localTextBundle;
        } );
};

loadConfiguration();

/**
 * Ctm1ContentMgmtTranslationService factory
 */

export default exports = {
    createTranslationDelivery,
    updateCreateButton,
    updateDeliverDecomposed,
    createTranslationOrder
};
