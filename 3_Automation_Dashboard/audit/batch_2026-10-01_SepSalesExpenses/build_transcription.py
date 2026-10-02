import json, os, hashlib

sha256_map = {
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_1.jpg': '9a9cf100a15dead7d41087aa14351f32bf50342f2b8c787e83efb0e921c0e0b2',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_2.jpg': '8ff82f487f4230d2b8618c8c3ff5b97970066b5d6ff37258dbd96610b662cb33',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_3.jpg': '426e89b559c541214e28c16e0aa9a03d262af5df79961c3e18a233cf40da4b1d',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_4.jpg': 'f233b4b28d23967132669424ea943c8ef81da7919ba0ae8b0296f3927330d5c1',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_5.jpg': 'ec31b2978165d42052a2310cca4fb73b4f968aa896d0a15949147d842c68cd40',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_6.jpg': '96a098c235cb7a796a6190e51f3a03b0179618ea42d293091bacec9f114b72ae',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_7.jpg': '1a5e3c92f34e25bfa04741740c24a2b801e1fda6b7953ad0dcdef32c7d3e9230',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_8.jpg': '4fdef27a4a36429b56759824a32103f7cc973b6ae025c96d5b1f7531877c9a71',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_9.jpg': 'b83d02399cf90b346aaf7bf2a3c4c0e73391083a59c1587c4c84cdaaaf1761b8',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_10.jpg': 'dd3d142adc2823867a8fbbdf75688204f0efd52cfd0bf8625cf923ee9357401a',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_11.jpg': '9b682cf60dbd1021f41a603dde4a49d469967c726872e67cef1a937d01aa360d',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_12.jpg': 'd91db275ef5efcbf8f964a01b6c7e8354754ee919067f120422057b9d038e504',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_13.jpg': 'ade2376a5e55864161b158031d6eeb35dd689692b8fccb5e5d07a9ebf033e140',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_14.jpg': '738ab3cbc46f6387bb0017df58c5fd9a7db72436fa5171c41117965d59c21ef1',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_15.jpg': '9fd74ddac52d347a973f53aaf64b35f2cde7b6850c10827c9f28ad92833657c1',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_16.jpg': '5e47424ce64babb1ea10e0b5a8698223aa5d762a3276293ebd7f8bd5db83ec38',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_17.jpg': 'cbb2f64c90a7ecf9b34c98ecdb6c52f435b7fd1e918dde27147156397120a573',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_18.jpg': '2c1846f51644d2c228a87abaa21961defd29b7f6b80c00d755f543880b0ce79e',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_19.jpg': 'efc8490f632ba4f2ae0ad136909e04c2a4ce514bc49fd2052e02ccb81e0ec00b',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_20.jpg': '1d8bed686cf4872da31541e20af0f91724a1eb512c546ae5269401c40ea46c96',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_21.jpg': '55e0a84207648469341e14aaded2a65f1a154a6d42fb9701366e411d2a637748',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_22.jpg': '7647be11e54cd33689fd79f1a9ac1e111ceec7dce1154304909af8672f7d520c',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_23.jpg': '82cf101473e180cd1ada18b41b65e994d4689072bea392952ebb239f52e1b86e',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_24.jpg': '7d477654099c1d139d67cbe3e86bdeaeae54ad6b3fd9fe7c7414eb311ad53231',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_25.jpg': '427b103e7d67b9c054e1b4054271439c22f2d71abecef96c68a0ae3e82036f9c',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_26.jpg': '961fdc0196b0547c69ef0a59cf1f787597364116fad11cfc3bcc66677fc136c9',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_27.jpg': '6e1cac49bed795eb2a8ce1120785f0c43a88be4abbe004576cf660349c66c320',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_28.jpg': 'bd7384b82f6521914f8a93fee2d2e2c3feeff6aae7dca5dc7b20ef4e091467b0',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_29.jpg': '743204616f0167aca318140b504394383176df5cdd6dffbb1e391e47bc734f88',
    'LINE_ALBUM_Daily Sales Report B3(September)_261001_30.jpg': '75c7c29366a897c2210a5fc1437d2243bbbcb4dbd4638942dbf077b701909ef4'
}

print('Sha map defined with 30 items.')
