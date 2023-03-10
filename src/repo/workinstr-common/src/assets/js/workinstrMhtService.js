// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import AwHTTPService from 'js/awHttpService';

const LINE_BREAK = '=\r\n';

const setFrameContent = async function( fileUrl ) {
    const response = await AwHTTPService.instance.get( fileUrl );
    if( response && response.data ) {
        let text = response.data;
        const temp = text.toLowerCase();
        const begin = temp.indexOf( '<html' );
        const end = temp.indexOf( '</html>' );
        if( begin !== -1 && end !== -1 ) {
            text = text.substring( begin, end ).replace( new RegExp( LINE_BREAK, 'g' ), '' ).replace( new RegExp( '=3D', 'g' ), '=' );
        }
        return text;
    }
};


export default {
    setFrameContent
};
