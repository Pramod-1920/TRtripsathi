'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FiChevronDown,
  FiChevronRight,
  FiDownload,
  FiFlag,
  FiMapPin,
  FiNavigation,
  FiPlus,
  FiRefreshCw,
  FiSearch,
} from 'react-icons/fi';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import {
  bulkSeedPlaces,
  fetchPlacesHierarchy,
  patchPlaces,
  PlaceDistrictNode,
  PlaceMunicipalityNode,
  PlacePatchOperation,
  PlaceProvinceNode,
  PlacesHierarchyResponse,
} from '@/lib/extras';

type NodeType = 'province' | 'district' | 'municipality' | 'place';

type TreeNodeRef = {
  id: string;
  type: NodeType;
  name: string;
  deleted?: boolean;
  parentId?: string;
  provinceId?: string;
  districtId?: string;
};

type ToastItem = {
  id: string;
  type: 'success' | 'error';
  message: string;
};

type ContextMenuState = {
  x: number;
  y: number;
  node: TreeNodeRef;
};

type AddDialogState = {
  type: 'district' | 'municipality' | 'place';
  parentId: string;
  title: string;
};

type NepalSeedFile = {
  provinces: Array<{
    province?: string;
    districts?: string[];
    places?: Record<string, string[]>;
  }>;
};

type DistrictMunicipalitiesSeed = Array<Record<string, string[]>>;

type OpenMeteoResponse = {
  timezone?: string;
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
  };
  [key: string]: unknown;
};

function slugifyId(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildUniqueId(prefix: 'prov' | 'dist' | 'mun' | 'place', name: string, used: Set<string>) {
  const base = `${prefix}_${slugifyId(name) || 'node'}`;
  let candidate = base;
  let suffix = 2;

  while (used.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }

  used.add(candidate);
  return candidate;
}

function normalizeLookupKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function resolveDistrictKey(value: string) {
  const key = normalizeLookupKey(value);

  // Common spelling variants
  if (key === 'dhanusa') return 'dhanusha';
  if (key === 'kavrepalanchok') return 'kavrepalanchowk';
  if (key === 'tanahu') return 'tanahun';
  if (key === 'achham') return 'aachham';

  // Nawalparasi split naming variants
  if (key.includes('bardaghat')) return 'nawalparasi west';
  if (key.includes('susta east')) return 'nawalparasi state 4';

  // Rukum split naming variants
  if (key === 'rukum east') return 'rukum state 5';
  if (key === 'rukum west') return 'western rukum';

  return key;
}

function toSeedHierarchy(raw: NepalSeedFile): PlacesHierarchyResponse {
  const usedIds = new Set<string>();
  const lookup = new Map<string, string[]>();

  (raw.provinces ?? []).forEach((province) => {
    const record = province.places ?? {};
    Object.entries(record).forEach(([districtName, municipalities]) => {
      const key = resolveDistrictKey(districtName);
      const list = (municipalities ?? [])
        .map((item) => String(item ?? '').trim())
        .filter(Boolean);
      if (key && list.length > 0) {
        lookup.set(key, list);
      }
    });
  });

  return {
    provinces: (raw.provinces ?? []).map((province) => {
      const provinceName = String(province.province ?? '').trim();
      const provinceId = buildUniqueId('prov', provinceName, usedIds);
      const districts = (province.districts ?? []).map((districtNameRaw) => {
        const districtName = String(districtNameRaw ?? '').trim();
        const districtId = buildUniqueId('dist', districtName, usedIds);
        const municipalitySource = lookup.get(resolveDistrictKey(districtName)) ?? [];
        const seen = new Set<string>();
        const municipalities = municipalitySource
          .map((municipalityNameRaw) => String(municipalityNameRaw ?? '').trim())
          .filter(Boolean)
          .filter((name) => {
            const key = name.toLowerCase();
            if (seen.has(key)) {
              return false;
            }
            seen.add(key);
            return true;
          })
          .map((municipalityName) => ({
            id: buildUniqueId('mun', municipalityName, usedIds),
            name: municipalityName,
            places: [],
          }));

        return {
          id: districtId,
          name: districtName,
          municipalities,
        };
      });

      return {
        id: provinceId,
        name: provinceName,
        districts,
      };
    }),
  };
}

function hasActiveChildren(
  hierarchy: PlacesHierarchyResponse,
  node: TreeNodeRef,
) {
  if (node.type === 'province') {
    const province = hierarchy.provinces.find((item) => item.id === node.id);
    return Boolean(province?.districts.some((district) => district.deleted !== true));
  }

  if (node.type === 'district') {
    const province = hierarchy.provinces.find((item) => item.id === node.provinceId);
    const district = province?.districts.find((item) => item.id === node.id);
    return Boolean(district?.municipalities.some((municipality) => municipality.deleted !== true));
  }

  if (node.type === 'municipality') {
    const province = hierarchy.provinces.find((item) => item.id === node.provinceId);
    const district = province?.districts.find((item) => item.id === node.districtId);
    const municipality = district?.municipalities.find((item) => item.id === node.id);
    return Boolean(municipality?.places.some((place) => place.deleted !== true));
  }

  return false;
}

function nodeMatchesSearch(name: string, query: string) {
  if (!query.trim()) {
    return false;
  }

  return name.toLowerCase().includes(query.trim().toLowerCase());
}

export function PlacesManager() {
  const [hierarchy, setHierarchy] = useState<PlacesHierarchyResponse>({ provinces: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(true);
  const [expandedProvinceIds, setExpandedProvinceIds] = useState<Set<string>>(new Set());
  const [expandedDistrictIds, setExpandedDistrictIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [addDialog, setAddDialog] = useState<AddDialogState | null>(null);
  const [addName, setAddName] = useState('');
  const [selectedNode, setSelectedNode] = useState<TreeNodeRef | null>(null);
  const [editName, setEditName] = useState('');
  const [inlineError, setInlineError] = useState('');
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [weatherData, setWeatherData] = useState<OpenMeteoResponse | null>(null);
  const router = useRouter();
  const [seedModalOpen, setSeedModalOpen] = useState(false);
  const [disableModalNode, setDisableModalNode] = useState<TreeNodeRef | null>(null);
  const [cascadeDisableNode, setCascadeDisableNode] = useState<TreeNodeRef | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showAllExpanded, setShowAllExpanded] = useState(false);

  const addToast = (type: ToastItem['type'], message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { id, type, message }]);
    setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3000);
  };

  const fetchHierarchy = async (includeDeleted = showDeleted) => {
    setLoading(true);
    setContextMenu(null);

    try {
      const response = await fetchPlacesHierarchy({ includeDeleted });
      setHierarchy(response);
    } catch {
      addToast('error', 'Failed to load places hierarchy.');
      setHierarchy({ provinces: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchHierarchy(showDeleted);
  }, [showDeleted]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const selectedResolved = useMemo(() => {
    if (!selectedNode) {
      return null;
    }

    for (const province of hierarchy.provinces) {
      if (province.id === selectedNode.id) {
        return { ...selectedNode, name: province.name, deleted: province.deleted };
      }
      for (const district of province.districts) {
        if (district.id === selectedNode.id) {
          return {
            ...selectedNode,
            name: district.name,
            deleted: district.deleted,
            provinceId: province.id,
          };
        }
        for (const municipality of district.municipalities) {
          if (municipality.id === selectedNode.id) {
            return {
              ...selectedNode,
              name: municipality.name,
              deleted: municipality.deleted,
              provinceId: province.id,
              districtId: district.id,
            };
          }
          for (const place of municipality.places ?? []) {
            if (place.id === selectedNode.id) {
              return {
                ...selectedNode,
                name: place.name,
                deleted: place.deleted,
                provinceId: province.id,
                districtId: district.id,
                parentId: municipality.id,
              };
            }
          }
        }
      }
    }

    return selectedNode;
  }, [hierarchy.provinces, selectedNode]);

  useEffect(() => {
    if (!selectedResolved) {
      return;
    }

    setSelectedNode(selectedResolved);
    setEditName(selectedResolved.name);
  }, [selectedResolved?.id, selectedResolved?.name, selectedResolved?.deleted]);

  // Fetch weather for selected place (municipality or district) using backend proxy
  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      setWeatherError('');
      setWeatherData(null);
      if (!selectedResolved) return;

      // We only fetch weather for municipalities or districts (places)
      if (!['place', 'municipality', 'district'].includes(selectedResolved.type)) {
        return;
      }

      setWeatherLoading(true);

      try {
        // Build a helpful geocode query using province/district context
        const province = hierarchy.provinces.find((p) => p.id === selectedResolved.provinceId);
        const district = province?.districts.find((d) => d.id === selectedResolved.districtId);
        const municipality = district?.municipalities.find(
          (item) => item.id === selectedResolved.parentId || item.id === selectedResolved.id,
        );
        const parts = [selectedResolved.name, municipality?.name, district?.name, province?.name, 'Nepal'].filter(Boolean).join(', ');

        const geoResp = await apiClient.get('/admin/geocode', { params: { q: parts } });
        const geo = Array.isArray(geoResp.data) && geoResp.data.length > 0 ? geoResp.data[0] : null;
        if (!geo) {
          setWeatherError('Geocoding failed (no results).');
          return;
        }

        const lat = geo.lat ?? geo.latitude ?? geo.latitude;
        const lon = geo.lon ?? geo.longitude ?? geo.long;
        if (!lat || !lon) {
          setWeatherError('Geocoding returned no coordinates.');
          return;
        }

        const weatherResp = await apiClient.get('/admin/weather', { params: { lat: String(lat), lon: String(lon) } });
        if (cancelled) return;
        setWeatherData(weatherResp.data ?? null);
      } catch (err) {
        let message = 'Failed to load weather.';
        if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
          message = err.message;
        } else if (typeof err === 'string') {
          message = err;
        }
        setWeatherError(message);
      } finally {
        setWeatherLoading(false);
      }
    }

    void loadWeather();

    return () => {
      cancelled = true;
    };
  }, [selectedResolved?.id]);

  const filteredTree = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return hierarchy.provinces;
    }

    return hierarchy.provinces
      .map((province) => {
        const provinceMatch = province.name.toLowerCase().includes(query);

        const districts = province.districts
          .map((district) => {
            const districtMatch = district.name.toLowerCase().includes(query);
            const municipalities = district.municipalities
              .map((municipality) => {
                if (municipality.name.toLowerCase().includes(query)) {
                  return municipality;
                }
                const places = (municipality.places ?? []).filter((place) =>
                  place.name.toLowerCase().includes(query));
                return places.length > 0 ? { ...municipality, places } : null;
              })
              .filter((municipality): municipality is PlaceMunicipalityNode => Boolean(municipality));

            if (districtMatch) {
              return district;
            }

            if (municipalities.length > 0) {
              return {
                ...district,
                municipalities,
              };
            }

            return null;
          })
          .filter((district): district is PlaceDistrictNode => Boolean(district));

        if (provinceMatch) {
          return province;
        }

        if (districts.length > 0) {
          return {
            ...province,
            districts,
          };
        }

        return null;
      })
      .filter((province): province is PlaceProvinceNode => Boolean(province));
  }, [hierarchy.provinces, search]);

  const summary = useMemo(() => {
    const provinces = hierarchy.provinces.length;
    const districts = hierarchy.provinces.reduce((count, province) => count + province.districts.length, 0);
    const municipalities = hierarchy.provinces.reduce(
      (count, province) => count + province.districts.reduce((dCount, district) => dCount + district.municipalities.length, 0),
      0,
    );
    const places = hierarchy.provinces.reduce(
      (count, province) => count + province.districts.reduce(
        (districtCount, district) => districtCount + district.municipalities.reduce(
          (municipalityCount, municipality) => municipalityCount + (municipality.places ?? []).length,
          0,
        ),
        0,
      ),
      0,
    );

    return { provinces, districts, municipalities, places };
  }, [hierarchy.provinces]);

  const openAddDistrict = (province: TreeNodeRef) => {
    setAddDialog({
      type: 'district',
      parentId: province.id,
      title: `Add District in ${province.name}`,
    });
    setAddName('');
    setInlineError('');
  };

  const openAddMunicipality = (district: TreeNodeRef) => {
    setAddDialog({
      type: 'municipality',
      parentId: district.id,
      title: `Add Municipality in ${district.name}`,
    });
    setAddName('');
    setInlineError('');
  };

  const openAddPlace = (municipality: TreeNodeRef) => {
    setAddDialog({
      type: 'place',
      parentId: municipality.id,
      title: `Add Place in ${municipality.name}`,
    });
    setAddName('');
    setInlineError('');
  };
  useEffect(() => {
    if (!search.trim()) {
      return;
    }

    const provinceIds = new Set<string>();
    const districtIds = new Set<string>();

    filteredTree.forEach((province) => {
      provinceIds.add(province.id);
      province.districts.forEach((district) => districtIds.add(district.id));
    });

    setExpandedProvinceIds(provinceIds);
    setExpandedDistrictIds(districtIds);
  }, [filteredTree, search]);

  const runOperation = async (operation: PlacePatchOperation, successMessage: string) => {
    setBusy(true);
    setInlineError('');
    setContextMenu(null);

    try {
      const response = await patchPlaces([operation]);
      setHierarchy(response);
      addToast('success', successMessage);
    } catch (error) {
      const message = (
        error as {
          response?: {
            data?: {
              message?: string;
            };
          };
        }
      ).response?.data?.message ?? 'Operation failed.';

      addToast('error', message);
      setInlineError(message);
    } finally {
      setBusy(false);
    }
  };

  const buildCascadeDisableOperations = (node: TreeNodeRef): PlacePatchOperation[] => {
    const ops: PlacePatchOperation[] = [];

    if (node.type === 'place') {
      if (node.deleted !== true) {
        ops.push({ op: 'delete', id: node.id });
      }
      return ops;
    }

    if (node.type === 'municipality') {
      const province = hierarchy.provinces.find((item) => item.id === node.provinceId);
      const district = province?.districts.find((item) => item.id === node.districtId);
      const municipality = district?.municipalities.find((item) => item.id === node.id);
      (municipality?.places ?? []).forEach((place) => {
        if (place.deleted !== true) ops.push({ op: 'delete', id: place.id });
      });
      if (municipality?.deleted !== true) ops.push({ op: 'delete', id: node.id });
      return ops;
    }

    if (node.type === 'district') {
      const province = hierarchy.provinces.find((item) => item.id === node.provinceId);
      const district = province?.districts.find((item) => item.id === node.id);
      const municipalities = district?.municipalities ?? [];
      municipalities.forEach((municipality) => {
        (municipality.places ?? []).forEach((place) => {
          if (place.deleted !== true) ops.push({ op: 'delete', id: place.id });
        });
        if (municipality.deleted !== true) {
          ops.push({ op: 'delete', id: municipality.id });
        }
      });
      if (district?.deleted !== true) {
        ops.push({ op: 'delete', id: node.id });
      }
      return ops;
    }

    const province = hierarchy.provinces.find((item) => item.id === node.id);
    const districts = province?.districts ?? [];
    districts.forEach((district) => {
      (district.municipalities ?? []).forEach((municipality) => {
        (municipality.places ?? []).forEach((place) => {
          if (place.deleted !== true) ops.push({ op: 'delete', id: place.id });
        });
        if (municipality.deleted !== true) {
          ops.push({ op: 'delete', id: municipality.id });
        }
      });
      if (district.deleted !== true) {
        ops.push({ op: 'delete', id: district.id });
      }
    });
    if (province?.deleted !== true) {
      ops.push({ op: 'delete', id: node.id });
    }
    return ops;
  };

  const handleCascadeDisable = async (node: TreeNodeRef) => {
    const operations = buildCascadeDisableOperations(node);
    if (operations.length === 0) {
      addToast('success', 'Already disabled.');
      return;
    }

    setBusy(true);
    setInlineError('');
    setContextMenu(null);

    try {
      const response = await patchPlaces(operations);
      setHierarchy(response);
      addToast('success', 'Disabled with children.');
    } catch (error) {
      const message = (
        error as {
          response?: { data?: { message?: string } };
        }
      ).response?.data?.message ?? 'Operation failed.';
      addToast('error', message);
      setInlineError(message);
    } finally {
      setBusy(false);
    }
  };

  const submitRenameSelected = async () => {
    if (!selectedNode) {
      return;
    }

    const name = editName.trim();
    if (!name) {
      setInlineError('Name is required.');
      return;
    }

    const lower = name.toLowerCase();
    let duplicate = false;

    if (selectedNode.type === 'province') {
      duplicate = hierarchy.provinces.some(
        (province) => province.id !== selectedNode.id && province.name.trim().toLowerCase() === lower,
      );
    } else if (selectedNode.type === 'district') {
      const province = hierarchy.provinces.find((item) => item.id === selectedNode.provinceId);
      duplicate = Boolean(province?.districts.some(
        (district) => district.id !== selectedNode.id && district.name.trim().toLowerCase() === lower,
      ));
    } else if (selectedNode.type === 'municipality') {
      const province = hierarchy.provinces.find((item) => item.id === selectedNode.provinceId);
      const district = province?.districts.find((item) => item.id === selectedNode.districtId);
      duplicate = Boolean(district?.municipalities.some(
        (municipality) => municipality.id !== selectedNode.id && municipality.name.trim().toLowerCase() === lower,
      ));
    } else {
      const province = hierarchy.provinces.find((item) => item.id === selectedNode.provinceId);
      const district = province?.districts.find((item) => item.id === selectedNode.districtId);
      const municipality = district?.municipalities.find((item) => item.id === selectedNode.parentId);
      duplicate = Boolean(municipality?.places?.some(
        (place) => place.id !== selectedNode.id && place.name.trim().toLowerCase() === lower,
      ));
    }

    if (duplicate) {
      setInlineError('Name already exists under the same parent.');
      return;
    }

    await runOperation(
      { op: 'rename', id: selectedNode.id, name },
      'Name updated.',
    );
  };

  const handleDelete = async (node: TreeNodeRef) => {
    if (hasActiveChildren(hierarchy, node)) {
      const warning = 'You must delete all children first.';
      addToast('error', warning);
      setInlineError(warning);
      return;
    }

    await runOperation(
      {
        op: 'delete',
        id: node.id,
      },
      'Disabled.',
    );
  };

  const handleRestore = async (node: TreeNodeRef) => {
    await runOperation(
      {
        op: 'restore',
        id: node.id,
      },
      'Enabled.',
    );
  };

  const handleHardDelete = async (node: TreeNodeRef) => {
    await runOperation(
      {
        op: 'hard_delete',
        id: node.id,
      },
      'Deleted permanently.',
    );

    setSelectedNode((current) => (current?.id === node.id ? null : current));
    setEditName('');
  };

  const submitAdd = async () => {
    if (!addDialog) {
      return;
    }

    const name = addName.trim();
    if (!name) {
      setInlineError('Name is required.');
      return;
    }

    const isDuplicate = hierarchy.provinces.some((province) => {
      if (addDialog.type === 'district' && province.id === addDialog.parentId) {
        return province.districts.some(
          (district) => district.name.trim().toLowerCase() === name.toLowerCase(),
        );
      }

      if (addDialog.type === 'municipality') {
        const district = province.districts.find((item) => item.id === addDialog.parentId);
        if (!district) {
          return false;
        }

        return district.municipalities.some(
          (municipality) => municipality.name.trim().toLowerCase() === name.toLowerCase(),
        );
      }

      if (addDialog.type === 'place') {
        const municipality = province.districts
          .flatMap((district) => district.municipalities)
          .find((item) => item.id === addDialog.parentId);
        return Boolean(municipality?.places?.some(
          (place) => place.name.trim().toLowerCase() === name.toLowerCase(),
        ));
      }

      return false;
    });

    if (isDuplicate) {
      setInlineError('Name already exists under this parent.');
      return;
    }

    setBusy(true);
    setInlineError('');

    try {
      const response = await patchPlaces([{
        op: 'add',
        type: addDialog.type,
        parentId: addDialog.parentId,
        name,
      }]);

      setHierarchy(response);
      setAddDialog(null);
      setAddName('');
      const label = addDialog.type === 'district'
        ? 'District'
        : addDialog.type === 'municipality'
          ? 'Municipality'
          : 'Place';
      addToast('success', `${label} added.`);
    } catch (error) {
      const message = (
        error as {
          response?: {
            data?: {
              message?: string;
            };
          };
        }
      ).response?.data?.message ?? 'Add operation failed.';

      setInlineError(message);
      addToast('error', message);
    } finally {
      setBusy(false);
    }
  };

  // Removed the old "Simple Editor" quick-actions in favor of a single, focused editor panel.

  const seedNepal = async () => {
    setBusy(true);
    setSeedModalOpen(false);

    try {
      const [hierarchyResponse, districtsResponse] = await Promise.all([
        fetch('/data/nepal-hierarchy.json'),
        fetch('/data/district_municipalites.json'),
      ]);

      const base = await hierarchyResponse.json() as NepalSeedFile;
      const districtMunicipalities = await districtsResponse.json() as DistrictMunicipalitiesSeed;

      const merged: NepalSeedFile = {
        provinces: (base.provinces ?? []).map((province) => ({
          ...province,
          places: { ...(province.places ?? {}) },
        })),
      };

      const districtMap = new Map<string, string[]>();
      (districtMunicipalities ?? []).forEach((item) => {
        Object.entries(item).forEach(([district, municipalities]) => {
          const key = resolveDistrictKey(district);
          const list = (municipalities ?? []).map((name) => String(name ?? '').trim()).filter(Boolean);
          if (key && list.length > 0) {
            districtMap.set(key, list);
          }
        });
      });

      merged.provinces.forEach((province) => {
        const nextPlaces: Record<string, string[]> = { ...(province.places ?? {}) };
        (province.districts ?? []).forEach((districtNameRaw) => {
          const districtName = String(districtNameRaw ?? '').trim();
          if (!districtName) {
            return;
          }
          const match = districtMap.get(resolveDistrictKey(districtName));
          if (match && match.length > 0) {
            nextPlaces[districtName] = match;
          }
        });
        province.places = nextPlaces;
      });

      const payload = toSeedHierarchy(merged);
      const seeded = await bulkSeedPlaces(payload);
      setHierarchy(showDeleted ? seeded : {
        provinces: seeded.provinces.filter((province) => province.deleted !== true).map((province) => ({
          ...province,
          districts: province.districts.filter((district) => district.deleted !== true).map((district) => ({
            ...district,
            municipalities: district.municipalities
              .filter((municipality) => municipality.deleted !== true)
              .map((municipality) => ({
                ...municipality,
                places: (municipality.places ?? []).filter((place) => place.deleted !== true),
              })),
          })),
        })),
      });
      addToast('success', 'Nepal hierarchy seeded successfully (district municipalities imported).');
    } catch {
      addToast('error', 'Failed to seed Nepal hierarchy.');
    } finally {
      setBusy(false);
    }
  };

  const exportHierarchy = () => {
    const content = JSON.stringify({ provinces: hierarchy.provinces }, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'places-hierarchy-export.json';
    anchor.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Hierarchy exported.');
  };

  const toggleExpandAll = () => {
    if (!showAllExpanded) {
      const nextProvinceIds = new Set<string>();
      const nextDistrictIds = new Set<string>();
      hierarchy.provinces.forEach((province) => {
        nextProvinceIds.add(province.id);
        province.districts.forEach((district) => nextDistrictIds.add(district.id));
      });
      setExpandedProvinceIds(nextProvinceIds);
      setExpandedDistrictIds(nextDistrictIds);
      setShowAllExpanded(true);
      return;
    }

    setExpandedProvinceIds(new Set());
    setExpandedDistrictIds(new Set());
    setShowAllExpanded(false);
  };

  const toggleProvince = (id: string) => {
    setExpandedProvinceIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleDistrict = (id: string) => {
    setExpandedDistrictIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderNodeLabel = (node: TreeNodeRef, depth: number) => {
    const isDeleted = node.deleted === true;
    const matched = nodeMatchesSearch(node.name, search);
    const isSelected = selectedNode?.id === node.id;
    const baseClass = `${isDeleted ? 'text-slate-400 line-through' : 'text-slate-800'} ${matched ? 'bg-yellow-100 rounded px-1' : ''}`;

    const icon = node.type === 'province'
      ? <FiFlag className="text-blue-600" size={14} />
      : node.type === 'district'
        ? <FiMapPin className="text-indigo-600" size={14} />
        : <FiNavigation className="text-cyan-600" size={14} />;

    return (
      <div
        className={`group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50 ${isSelected ? 'bg-blue-50 ring-1 ring-blue-200' : ''}`}
        style={{ marginLeft: `${depth * 16}px` }}
        onContextMenu={(event) => {
          event.preventDefault();
          setContextMenu({
            x: event.clientX,
            y: event.clientY,
            node,
          });
        }}
        onClick={() => {
          setSelectedNode(node);
          setEditName(node.name);
          setInlineError('');
        }}
      >
        {icon}
        <span className={`text-sm ${baseClass}`}>{node.name}</span>
      </div>
    );
  };

  return (
    <div className="p-8 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Places</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage Province → District → Municipality → Place. Add a place using its title only.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
              Provinces: {summary.provinces}
            </span>
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700">
              Districts: {summary.districts}
            </span>
            <span className="rounded-full bg-cyan-50 px-2.5 py-1 font-medium text-cyan-700">
              Municipalities: {summary.municipalities}
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
              Places: {summary.places}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleExpandAll}
            disabled={busy || loading}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {showAllExpanded ? 'Collapse All' : 'Expand All'}
          </button>
          <button
            type="button"
            onClick={() => setSeedModalOpen(true)}
            disabled={busy}
            className="rounded-lg bg-amber-600 px-3 py-2 text-sm text-white hover:bg-amber-700 disabled:opacity-60"
          >
            Seed Nepal
          </button>
          <button
            type="button"
            onClick={exportHierarchy}
            disabled={busy || loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <FiDownload size={14} />
            Export
          </button>
          <button
            type="button"
            onClick={() => void fetchHierarchy(showDeleted)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <FiRefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block w-full max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search province, district, municipality or place..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(event) => setShowDeleted(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Show disabled
        </label>
      </div>
      {inlineError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {inlineError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[420px_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-slate-900">Hierarchy</h2>
            <p className="text-xs text-slate-500">Click a node to edit. Right click for quick actions.</p>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading places tree...</p>
          ) : filteredTree.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No nodes found.</p>
          ) : (
            <div className="space-y-1">
              {filteredTree.map((province) => {
                const provinceExpanded = expandedProvinceIds.has(province.id) || search.trim().length > 0;

                return (
                  <div key={province.id}>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => toggleProvince(province.id)}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100"
                        aria-label={provinceExpanded ? 'Collapse province' : 'Expand province'}
                      >
                        {provinceExpanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                      </button>
                      {renderNodeLabel({
                        id: province.id,
                        type: 'province',
                        name: province.name,
                        deleted: province.deleted,
                      }, 0)}
                    </div>
                    {provinceExpanded && province.districts.map((district) => {
                      const districtExpanded = expandedDistrictIds.has(district.id) || search.trim().length > 0;

                      return (
                        <div key={district.id}>
                          <div className="flex items-center">
                            <button
                              type="button"
                              onClick={() => toggleDistrict(district.id)}
                              className="ml-4 rounded p-1 text-slate-500 hover:bg-slate-100"
                              aria-label={districtExpanded ? 'Collapse district' : 'Expand district'}
                            >
                              {districtExpanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                            </button>
                            {renderNodeLabel({
                              id: district.id,
                              type: 'district',
                              name: district.name,
                              deleted: district.deleted,
                              provinceId: province.id,
                            }, 1)}
                          </div>
                          {districtExpanded && district.municipalities.map((municipality) => (
                            <div key={municipality.id} className="ml-10">
                              {renderNodeLabel({
                                id: municipality.id,
                                type: 'municipality',
                                name: municipality.name,
                                deleted: municipality.deleted,
                                provinceId: province.id,
                                districtId: district.id,
                              }, 2)}
                              {(municipality.places ?? []).map((place) => (
                                <div key={place.id} className="ml-7 border-l border-slate-200 pl-2">
                                  {renderNodeLabel({
                                    id: place.id,
                                    type: 'place',
                                    name: place.name,
                                    deleted: place.deleted,
                                    parentId: municipality.id,
                                    provinceId: province.id,
                                    districtId: district.id,
                                  }, 3)}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Editor</h2>
            <p className="text-xs text-slate-500">Rename, add children, and enable/disable.</p>
          </div>

          {!selectedNode ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Select a province, district, municipality, or place from the left to edit.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Selected</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{selectedNode.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Type: <span className="font-medium text-slate-700">{selectedNode.type}</span>
                      {selectedNode.deleted ? (
                        <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Disabled</span>
                      ) : (
                        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Enabled</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedNode.deleted ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleRestore(selectedNode)}
                          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                        >
                          Enable
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setDisableModalNode(selectedNode)}
                          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                        >
                          Delete permanently
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setCascadeDisableNode(selectedNode)}
                          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                        >
                          Disable with children
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setDisableModalNode(selectedNode)}
                          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                        >
                          Disable (Remove)
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">Rename</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    disabled={busy}
                    className="flex-1 min-w-[240px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter new name"
                  />
                  <button
                    type="button"
                    disabled={busy || !editName.trim() || editName.trim() === selectedNode.name.trim()}
                    onClick={() => void submitRenameSelected()}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">Add child</p>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedNode.type === 'province'
                    ? 'Add a district under this province.'
                    : selectedNode.type === 'district'
                      ? 'Add a municipality under this district.'
                      : selectedNode.type === 'municipality'
                        ? 'Add a place under this municipality. Only its title is required.'
                        : 'Places cannot contain children.'}
                </p>
                <div className="mt-3">
                  {selectedNode.type === 'province' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openAddDistrict(selectedNode)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <FiPlus size={14} />
                      Add District
                    </button>
                  )}
                  {selectedNode.type === 'district' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openAddMunicipality(selectedNode)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <FiPlus size={14} />
                      Add Municipality
                    </button>
                  )}
                  {selectedNode.type === 'municipality' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openAddPlace(selectedNode)}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                    >
                      <FiPlus size={14} />
                      Add Place Title
                    </button>
                  )}
                </div>
              </div>
              {/* Weather preview panel */}
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">Weather preview</p>
                <p className="mt-1 text-xs text-slate-500">Preview approximate weather for the selected place (provided by Open-Meteo via server proxy).</p>
                <div className="mt-3">
                  {weatherLoading ? (
                    <div className="text-sm text-slate-500">Loading weather...</div>
                  ) : weatherError ? (
                    <div className="text-sm text-red-600">{weatherError}</div>
                  ) : weatherData ? (
                    <div className="text-sm text-slate-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-500">Timezone</div>
                        <div className="font-medium">{weatherData?.timezone ?? 'UTC'}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-500">Daily max</div>
                        <div className="font-medium">{weatherData?.daily?.temperature_2m_max?.[0] ?? '—'} °C</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-500">Daily min</div>
                        <div className="font-medium">{weatherData?.daily?.temperature_2m_min?.[0] ?? '—'} °C</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-500">Precipitation</div>
                        <div className="font-medium">{weatherData?.daily?.precipitation_sum?.[0] ?? '—'} mm</div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            if (!selectedResolved) return;
                            // Pass selection and weather via query string and navigate to campaign add (no sessionStorage)
                            try {
                              const payload = { place: selectedResolved, weather: weatherData };
                              const encoded = encodeURIComponent(JSON.stringify(payload));
                              // Navigate to campaign add page, passing the selection in the query string
                              router.push(`/campaigns/add?selectedPlace=${encoded}`);
                            } catch {
                              addToast('error', 'Failed to select place.');
                            }
                          }}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          Use this place (copy details)
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setWeatherData(null);
                            setWeatherError('');
                          }}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">Select a municipality or district to preview weather.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 min-w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.node.type === 'province' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setAddDialog({
                  type: 'district',
                  parentId: contextMenu.node.id,
                  title: 'Add District',
                });
                setAddName('');
                setInlineError('');
                setContextMenu(null);
              }}
              className="w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              Add District
            </button>
          )}
          {contextMenu.node.type === 'district' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setAddDialog({
                  type: 'municipality',
                  parentId: contextMenu.node.id,
                  title: 'Add Municipality',
                });
                setAddName('');
                setInlineError('');
                setContextMenu(null);
              }}
              className="w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              Add Municipality
            </button>
          )}
          {contextMenu.node.type === 'municipality' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setAddDialog({
                  type: 'place',
                  parentId: contextMenu.node.id,
                  title: 'Add Place Title',
                });
                setAddName('');
                setInlineError('');
                setContextMenu(null);
              }}
              className="w-full rounded px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
            >
              Add Place Title
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setSelectedNode(contextMenu.node);
              setEditName(contextMenu.node.name);
              setInlineError('');
              setContextMenu(null);
            }}
            className="w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Select
          </button>
          {contextMenu.node.deleted === true ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRestore(contextMenu.node)}
                className="w-full rounded px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
              >
                Enable
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setDisableModalNode(contextMenu.node)}
                className="w-full rounded px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Delete permanently
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setDisableModalNode(contextMenu.node)}
              className="w-full rounded px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Disable
            </button>
          )}
        </div>
      )}

      {addDialog && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">{addDialog.title}</h3>
            <p className="mt-1 text-sm text-slate-600">Enter the node name only. ID will be generated automatically.</p>
            <input
              autoFocus
              value={addName}
              onChange={(event) => setAddName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void submitAdd();
                }
                if (event.key === 'Escape') {
                  setAddDialog(null);
                  setAddName('');
                  setInlineError('');
                }
              }}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type name"
              disabled={busy}
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAddDialog(null);
                  setAddName('');
                  setInlineError('');
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitAdd()}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <FiPlus size={14} />
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={seedModalOpen}
        title="Replace all places hierarchy?"
        description="This replaces all existing places. Continue?"
        confirmLabel="Seed Nepal"
        cancelLabel="Cancel"
        onConfirm={seedNepal}
        onCancel={() => setSeedModalOpen(false)}
      />

      <ConfirmModal
        open={Boolean(disableModalNode)}
        title={disableModalNode?.deleted ? 'Delete permanently?' : 'Disable this place?'}
        description={disableModalNode?.deleted
          ? 'This will permanently remove it from the system. This cannot be undone.'
          : 'This will hide it from users (you can re-enable later). You must disable all children first.'}
        confirmLabel={disableModalNode?.deleted ? 'Delete permanently' : 'Disable'}
        cancelLabel="Cancel"
        onConfirm={() => {
          if (!disableModalNode) {
            return;
          }
          if (disableModalNode.deleted) {
            void handleHardDelete(disableModalNode);
          } else {
            void handleDelete(disableModalNode);
          }
          setDisableModalNode(null);
        }}
        onCancel={() => setDisableModalNode(null)}
      />

      <ConfirmModal
        open={Boolean(cascadeDisableNode)}
        title="Disable with children?"
        description="This will disable the selected node and automatically disable all enabled children first."
        confirmLabel="Disable with children"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (!cascadeDisableNode) {
            return;
          }
          void handleCascadeDisable(cascadeDisableNode);
          setCascadeDisableNode(null);
        }}
        onCancel={() => setCascadeDisableNode(null)}
      />

      <div className="fixed right-4 top-4 z-[60] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-64 rounded-lg border px-3 py-2 text-sm shadow-lg ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
