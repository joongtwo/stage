// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/workinstrGalleryViewerService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import workinstrFmsSvc from 'js/workinstrFileTicketService';


let autoLoad3D = isAutoLoad3D();

/**
 * Check if 3D should be automatically loaded
 *
 * @return {String} when value is 'true' - 3D should be automatically loaded
 */
function isAutoLoad3D() {
    const workinstr0VisCtx = appCtxSvc.getCtx( 'workinstr0Vis' );
    return workinstr0VisCtx ? workinstr0VisCtx.autoLoad3D : 'false';
}

/**
 * Set the viewer data
 *
 * @param {Map} widgets map of type: viewer
 * @param {Object} tabData the active tab data
 * @param {ModelObject} item the item object to display in the viewer
 * @param {String} fileTicket the file ticket
 * @param {String} fileURL the file URL
 * @param {String} viewer the viewer name to display the file in
 *
 * @returns {Object} viewerData
 */
function setViewerData( widgets, tabData, item, fileTicket, fileURL, viewer ) {
    let typeViewer = viewer;
    if( !typeViewer ) {
        typeViewer = tabData.viewMode.viewer;
    }
    if( !typeViewer ) {
        typeViewer = widgets[ item.type ];
    }
    if( !typeViewer ) {
        const NOT_FOUND = -1;
        if( item.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > NOT_FOUND ) {
            typeViewer = widgets.ItemRevision;
        }
    }
    if( !typeViewer ) {
        if( item.props.file_ext ) {
            typeViewer = widgets[ item.props.file_ext.dbValues[ 0 ] ];
        } else if( item.props.ref_list ) {
            const fileExt = workinstrFmsSvc.getFileExtension( item.props.ref_list.uiValue );
            typeViewer = widgets[ fileExt ];
        }
    }
    if( !typeViewer ) {
        typeViewer = 'WorkinstrDefaultViewer';
    }

    // The cortona data should always be 3 file tickets:
    // 1 - wrl movie file
    // 2 - interactivity.xml file
    // 3 - the work instructions xml file
    const fmsTicket = fileTicket === null ? fileTicket : fileTicket[ 0 ];
    const cortonaInteractivityTicket = fileTicket && fileTicket.length > 1 ? fileTicket[ 1 ] : null;
    const cortonaWorkInstructionsTicket = fileTicket && fileTicket.length > 2 ? fileTicket[ 2 ] : null;

    const contextNamespace = tabData.workareaName === 'popupMainPanelTabs' ? 'workinstrPopupViewer' : 'workinstrViewer';
    item.contextNamespace = contextNamespace;

    //need a unique selector to distinguish between the gallery on the different panels on the same screen
    const viewerRef = document.querySelector( '#' + tabData.workareaName + ' #workinstrGalleryContentPanel' );

    let viewerData = {
        fileData: {
            file: item,
            fmsTicket: fmsTicket,
            fileUrl: fileURL,
            viewer: typeViewer,
            cortonaInteractivityTicket: cortonaInteractivityTicket,
            cortonaWorkInstructionsTicket: cortonaWorkInstructionsTicket,
            useParentDimensions: true,
            contextNamespace: contextNamespace
        },
        hasMoreDatasets: false,
        uid: item.uid,
        useParentDimensions: true,
        myGalleryPanel: self,
        viewerRef: {
            current: viewerRef
        }
    };
    viewerData.datasetData = item;

    // Hide AW viewer commands
    appCtxSvc.registerCtx( 'viewerContext', {} );

    return viewerData;
}

/**
 * Get the snapshot Preview image or imagecapture
 *
 * @param {ModelObject} item the selected item object to display in the viewer
 *
 * @returns {String} the image uid
 */
function getSnapshotImageUid( item ) {
    const imanFiles = item.props.ref_list;
    const snapShotrefNames = item.props.ref_names.dbValues;
    if( imanFiles && snapShotrefNames ) {
        const refLen = snapShotrefNames.length;
        for( let refIndx = 0; refIndx < refLen; refIndx++ ) {
            if( _.endsWith( snapShotrefNames[ refIndx ], 'Image' ) ) {
                const imageName = _.lowerCase( imanFiles.uiValues[ refIndx ] );
                if( _.startsWith( imageName, 'imagecapture' ) || _.startsWith( imageName, 'preview' ) ) {
                    return imanFiles.dbValues[ refIndx ];
                }
            }
        }
    }
    return null;
}

/**
 * Thumbnail item was selected in the gallery list
 *
 * @param {Map} widgets map of type: viewer
 * @param {Object} tabData the active tab data
 * @param {ModelObject} item the selected item object to display in the viewer
 * @param {ModelObject} refList the parent item ref_list of the selected item, to have the ref_file in case of CME_Report
 *
 * @returns {Object} viewerData
 */
export function inputUpdated( widgets, tabData, item, refList ) {
    let viewerData = null;

    if( item.modelType && item.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1  || item.type === 'String' || item.type === 'FullText' || item.type === 'DirectModel' || item.type === 'Epw0WIDataset' ) {
        viewerData = setViewerData( widgets, tabData, item, null, null, null );
        return new Promise( ( res ) => res( viewerData ) );
    }
    let fileObjUid;
    let shouldGetTicket = false;
    let fileURL;
    if( refList ) {
        item.refList = refList;
    }
    if( item.type === 'Web Link' ) {
        const dataFileObj = cdm.getObject( item.props.data_file.dbValue );
        fileURL = dataFileObj.props.url.dbValues[ 0 ];
        viewerData = setViewerData( widgets, tabData, item, null, fileURL, null );
    } else if( item.type === 'CME_Report' ) {
        const refNames = item.props.ref_names.dbValues;
        const refLength = refNames.length;
        for( let refIndex = 0; refIndex < refLength; refIndex++ ) {
            if( refNames[ refIndex ] === 'Primary' ) {
                fileObjUid = item.props.ref_list.dbValues[ refIndex ];
                break;
            }
        }
        shouldGetTicket = true;
    } else if( item.type === 'SnapShotViewData' ) {
        // Setting the selection which will be used to create a vvi file.
        // selectionSvc.updateSelection(item);
        const fileUid = getSnapshotImageUid( item );
        if( fileUid && fileUid !== null ) {
            return workinstrFmsSvc.getFileTickets( [ fileUid ] ).then( function( fileTicketsResponse ) {
                const fileTicket = fileTicketsResponse[ fileUid ];
                if( fileTicket ) {
                    fileURL = workinstrFmsSvc.getFileURL( fileTicket[ 0 ] );
                }
                return setViewerData( widgets, tabData, item, null, fileURL, autoLoad3D === 'true' ? 'WorkinstrSnapshotViewer' : 'Awp0ImageViewer' );
            } );
        }
        viewerData =  setViewerData( widgets, tabData, item, null, item.thumbnailURL, autoLoad3D === 'true' ? 'WorkinstrSnapshotViewer' : 'Awp0ImageViewer' );
    } else {
        fileObjUid = item.props.ref_list ? item.props.ref_list.dbValues[ 0 ] : item.uid;
        shouldGetTicket = true;
    }

    if( shouldGetTicket === true ) {
        return workinstrFmsSvc.getFileTickets( [ fileObjUid ] ).then( function( fileTicketsResponse ) {
            const fileTicket = fileTicketsResponse[ fileObjUid ];
            if( fileTicket ) {
                fileURL = workinstrFmsSvc.getFileURL( fileTicket[ 0 ] );
            }
            return viewerData = setViewerData( widgets, tabData, item, fileTicket, fileURL, null );
        } );
    }

    return new Promise( ( res ) => res( viewerData ) );
}

export default {
    inputUpdated
};
