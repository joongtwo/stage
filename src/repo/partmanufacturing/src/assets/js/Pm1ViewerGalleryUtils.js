// Copyright (c) 2022 Siemens

/**
 * Viewer utility for dataset type 'UGCAMShopDoc' only
 * This utility is called when Pm1GalleryViewer (instead of Awp0GalleryViewer) is used in XRT rendering. 
 * Pm1GalleryViewer bypasses the OOTB preference AWC_defaultViewerConfig.VIEWERCONFIG
 * Note: This utility can be enhanced in future to support more dataset types if needed
 *
 * @module js/Pm1ViewerGalleryUtils
 */
import AwPromiseService from 'js/awPromiseService';
import AwUnivViewerSvc from 'js/AwUniversalViewerService';
import cdm from 'soa/kernel/clientDataModel';
import fileManagementService from 'soa/fileManagementService';
import policySvc from 'soa/kernel/propertyPolicyService';

var exports = {};

export let getPartMfgViewerDataSOA = function( subPanelContext ) {
    var deferred = AwPromiseService.instance.defer();

    var policyID = policySvc.register( {
        types: [ {
            name: 'ImanFile',
            properties: [ {
                name: 'file_size'
            } ]
        }
        ]
    } );

    var selection = AwUnivViewerSvc.getSelectionFromContext( subPanelContext );
    var datasetRef = selection.props.ref_list.dbValues;

    let refListModelObjects = cdm.getObjects( datasetRef );
    fileManagementService.getFileReadTickets( refListModelObjects ).then( function( ticketsResponse ) {
        if ( ticketsResponse && ticketsResponse.tickets && ticketsResponse.tickets.length > 1 ) {
            var response = {
                output : {
                    dataset: cdm.getObject( selection.uid ),
                    views:
                        [ {
                            file: cdm.getObject( datasetRef[0] ),
                            fmsTicket: '',
                            viewer: 'Awp0Preview' //default
                        } ],
                    hasMoreDatasets: false
                }
            };
            var ticket = ticketsResponse.tickets[1][0];
            var viewer = 'Awp0Preview'; //default
            //  getting correct viewer for various format of supported images and pdf
            if ( ticket.length > 28 ) {
                var n = ticket.lastIndexOf( '.' );
                var ticketExt = ticket.substring( n + 1 ).toUpperCase();
                viewer = getViewerType( ticketExt );
            }
            response.output.views[0].fmsTicket = ticket;
            response.output.views[0].viewer = viewer;
            deferred.resolve( response );
        }
    } );
    return deferred.promise;
};

function getViewerType( ticketExt ) {
    let viewerType = 'Awp0Preview'; // default

    const images = [ 'jpg', 'jpeg', 'bmp', 'tif', 'tiff', 'gif',  'png' ];
    const pdfs = [ 'pdf' ];
    const htmls = [ 'htm', 'html' ];
    const text = [ 'txt', 'ptp', 'prd', 'grs', 'exp' ];
    if ( images.indexOf( ticketExt.toString().toLowerCase() ) !== -1 ) {
        viewerType = 'Awp0ImageViewer';
    } else if ( pdfs.indexOf( ticketExt.toString().toLowerCase() ) !== -1 ) {
        viewerType = 'Awp0PDFViewer';
    } else if ( htmls.indexOf( ticketExt.toString().toLowerCase() ) !== -1 ) {
        viewerType = 'Awp0HTMLViewer';
    } else if ( text.indexOf( ticketExt.toString().toLowerCase() ) !== -1 ) {
        viewerType = 'Awp0TextViewer';
    }

    return viewerType;
}

export default exports = {
    getPartMfgViewerDataSOA
};
