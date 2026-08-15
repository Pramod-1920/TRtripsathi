/// Nepal's authoritative district-to-province registry used for completion.
///
/// Validated on 2026-08-15 against the National Statistics Office district
/// code catalog. Names use TripSathi's display identifiers; aliases below
/// bridge official and commonly used English spellings.
const nepalDistrictsByProvince = <int, Set<String>>{
  1: {
    'BHOJPUR',
    'DHANKUTA',
    'ILAM',
    'JHAPA',
    'KHOTANG',
    'MORANG',
    'OKHALDHUNGA',
    'PANCHTHAR',
    'SANKHUWASABHA',
    'SOLUKHUMBU',
    'SUNSARI',
    'TAPLEJUNG',
    'TEHRATHUM',
    'UDAYAPUR',
  },
  2: {
    'BARA',
    'DHANUSA',
    'MAHOTTARI',
    'PARSA',
    'RAUTAHAT',
    'SAPTARI',
    'SARLAHI',
    'SIRAHA',
  },
  3: {
    'BHAKTAPUR',
    'CHITWAN',
    'DHADING',
    'DOLAKHA',
    'KATHMANDU',
    'KAVREPALANCHOWK',
    'LALITPUR',
    'MAKWANPUR',
    'NUWAKOT',
    'RAMECHHAP',
    'RASUWA',
    'SINDHULI',
    'SINDHUPALCHOK',
  },
  4: {
    'BAGLUNG',
    'GORKHA',
    'KASKI',
    'LAMJUNG',
    'MANANG',
    'MUSTANG',
    'MYAGDI',
    'NAWALPUR',
    'PARBAT',
    'SYANGJA',
    'TANAHU',
  },
  5: {
    'ARGHAKHANCHI',
    'BANKE',
    'BARDIYA',
    'DANG',
    'EASTERN RUKUM',
    'GULMI',
    'KAPILVASTU',
    'PALPA',
    'PARASI',
    'PYUTHAN',
    'ROLPA',
    'RUPANDEHI',
  },
  6: {
    'DAILEKH',
    'DOLPA',
    'HUMLA',
    'JAJARKOT',
    'JUMLA',
    'KALIKOT',
    'MUGU',
    'SALYAN',
    'SURKHET',
    'WESTERN RUKUM',
  },
  7: {
    'ACHHAM',
    'BAITADI',
    'BAJHANG',
    'BAJURA',
    'DADELDHURA',
    'DARCHULA',
    'DOTI',
    'KAILALI',
    'KANCHANPUR',
  },
};

String _districtKey(String value) => value
    .trim()
    .toLowerCase()
    .replaceAll('&', 'and')
    .replaceAll(RegExp(r'[^a-z0-9]+'), '_')
    .replaceAll(RegExp(r'^_+|_+$'), '')
    .replaceFirst(RegExp(r'^district_of_'), '')
    .replaceFirst(RegExp(r'_district$'), '');

/// Returns all keys that may identify the same district in API/catalog data.
Set<String> nepalDistrictAliases(String name) {
  final raw = _districtKey(name);
  final canonical = switch (raw) {
    'sirah' => 'siraha',
    'dhanusha' => 'dhanusa',
    'kavrepalanchok' || 'kavreplanchok' || 'kavre' => 'kavrepalanchowk',
    'ramechap' => 'ramechhap',
    'makawanpur' => 'makwanpur',
    'chitawan' => 'chitwan',
    'sindhupalchowk' => 'sindhupalchok',
    'terhathum' => 'tehrathum',
    'tanahun' => 'tanahu',
    'manag' => 'manang',
    'kapilbastu' => 'kapilvastu',
    'dailekha' => 'dailekh',
    'rukum_east' || 'east_rukum' || 'rukum_eastern_part' => 'eastern_rukum',
    'rukum_west' || 'west_rukum' || 'rukum_western_part' => 'western_rukum',
    'nawalparasi_east' ||
    'east_nawalparasi' ||
    'nawalparasi_east_of_bardaghat_susta' ||
    'nawalparasi_eastern_part' =>
      'nawalpur',
    'nawalparasi_west' ||
    'west_nawalparasi' ||
    'nawalparasi_west_of_bardaghat_susta' ||
    'nawalparasi_western_part' =>
      'parasi',
    _ => raw,
  };

  final equivalents = switch (canonical) {
    'siraha' => {'sirah'},
    'dhanusa' => {'dhanusha'},
    'kavrepalanchowk' => {'kavrepalanchok', 'kavreplanchok', 'kavre'},
    'ramechhap' => {'ramechap'},
    'makwanpur' => {'makawanpur'},
    'chitwan' => {'chitawan'},
    'sindhupalchok' => {'sindhupalchowk'},
    'tehrathum' => {'terhathum'},
    'tanahu' => {'tanahun'},
    'manang' => {'manag'},
    'kapilvastu' => {'kapilbastu'},
    'dailekh' => {'dailekha'},
    'eastern_rukum' => {
        'rukum_east',
        'east_rukum',
        'rukum_eastern_part',
      },
    'western_rukum' => {
        'rukum_west',
        'west_rukum',
        'rukum_western_part',
      },
    'nawalpur' => {
        'nawalparasi_east',
        'east_nawalparasi',
        'nawalparasi_east_of_bardaghat_susta',
        'nawalparasi_eastern_part',
      },
    'parasi' => {
        'nawalparasi_west',
        'west_nawalparasi',
        'nawalparasi_west_of_bardaghat_susta',
        'nawalparasi_western_part',
      },
    _ => const <String>{},
  };

  return {raw, canonical, ...equivalents};
}
