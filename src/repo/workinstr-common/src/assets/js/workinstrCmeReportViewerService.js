// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import AwHTTPService from 'js/awHttpService';
import cdm from 'soa/kernel/clientDataModel';
import workinstrGalleryService from 'js/workinstrGalleryService';
import MfeLoadingMessage from 'viewmodel/MfeLoadingMessageViewModel';
import workinstrFmsSvc from 'js/workinstrFileTicketService';

/**
    To keep the original CME_report Named References for case
    a user clicks on a link in the CME_report which opens another CME_report
*/
let originRefList;

/**
 * Load the CME_report file and put it in the viewer dom iframe
 *
 * @param {Object} viewerData the viewer data
 */
const setFrameContent = async function( viewerData ) {
    const response = await AwHTTPService.instance.get( viewerData.fileData.fileUrl );
    if( response && response.data ) {
        let iframe = viewerData.viewerRef.current.querySelector( 'iframe' );
        let iframeDoc;
        if( iframe ) {
            if( iframe.contentDocument ) {
                iframeDoc = iframe.contentDocument;
            } else if( iframe.contentWindow ) {
                iframeDoc = iframe.contentWindow.document;
            }
        }

        if( iframeDoc ) {
            // Put the content in the iframe
            iframeDoc.open();
            const iframeDocContent = response.data;
            iframeDoc.writeln( iframeDocContent );
            iframeDoc.close();
        }
        replaceHrefs( viewerData );
    }
};

/**
 * Replace the href links in the CME_report to open the clicked links in the same viewer
 *
 * @param {Object} viewerData the viewer data
 */
const replaceHrefs = function( viewerData ) {
    const item = viewerData.datasetData;
    let refList = item.props.ref_list;
    if( !refList && item.refList ) {
        refList = item.refList;
    }
    if( !refList && originRefList ) {
        refList = originRefList;
    }
    if( refList ) {
        originRefList = refList;
        const refFileNamesList = refList.uiValues;
        const refFileUidsList = refList.dbValues;
        let iframe = viewerData.viewerRef.current.querySelector( 'iframe' );
        // To display the logo image
        const imgElements = iframe.contentDocument.querySelectorAll( 'img' );
        imgElements.forEach( currImgElem => {
            const imgSrc = currImgElem.getAttribute( 'src' );
            if( imgSrc ) {
                const refFileIndex = refFileNamesList.findIndex( refFile => refFile === imgSrc );
                if( refFileIndex > -1 ) {
                    const fileUid = refFileUidsList[ refFileIndex ];
                    workinstrFmsSvc.getFileTickets( [ fileUid ] ).then( function( fileTicketsResponse ) {
                        const fileTicket = fileTicketsResponse[ fileUid ];
                        if( fileTicket ) {
                            const fileURL = workinstrFmsSvc.getFileURL( fileTicket[ 0 ] );
                            currImgElem.setAttribute( 'src', fileURL );
                        }
                    } );
                }
            }
        } );
        // To display the clicked link in the gallery viewer
        const aElements = iframe.contentDocument.querySelectorAll( 'a' );
        aElements.forEach( currHrefElem => {
            const hrefStr = currHrefElem.getAttribute( 'href' );
            if( hrefStr ) {
                const refIndex = refFileNamesList.findIndex( refFile => refFile === hrefStr );
                if( refIndex > -1 ) {
                    const objUid = refFileUidsList[ refIndex ];
                    currHrefElem.setAttribute( 'id', objUid );
                    currHrefElem.setAttribute( 'href', '#' );
                    currHrefElem.onclick = function() {
                        const galleryContext = {
                            selectedItem: cdm.getObject( objUid )
                        };
                        // Send the clicked link to the gallery viewer galleryModel object
                        // as the selected dataset to display in the viewer
                        workinstrGalleryService.setGalleryContext( viewerData.galleryModel, galleryContext );
                    };
                }
            }
        } );
    }
    contentLoadComplete( viewerData );
};

const contentLoadComplete = function( viewerData ) {
    let iframe = viewerData.viewerRef.current.querySelector( 'iframe' );
    iframe.classList.remove( 'aw-workinstr-hidden' );
    iframe.previousElementSibling.remove();
};

/**
 * CME_report Viewer Render Function
 *
 * @returns {Object} dom element
 */
export const cmeReportViewerRenderFn = function() {
    return (
        <div id='workinstrCmeReportViewer' className='aw-workinstr-viewerStyle'>
            <MfeLoadingMessage className='aw-workinstr-viewerStyle'></MfeLoadingMessage>
            <iframe title='workinstrCmeReport' className='aw-workinstr-viewerStyle aw-workinstr-hidden'></iframe>
        </div>
    );
};

export default {
    cmeReportViewerRenderFn,
    setFrameContent
};
