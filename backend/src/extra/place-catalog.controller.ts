import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExtraService } from './extra.service';

@ApiTags('places')
@Controller('places')
export class PlaceCatalogController {
  constructor(private readonly extraService: ExtraService) {}

  @Get('catalog')
  @ApiOperation({
    summary:
      'Get active place catalog (province + districts + municipalities + places)',
  })
  @ApiOkResponse({
    description: 'Place catalog fetched successfully',
    example: {
      source: 'extras',
      items: [
        {
          province: 'BAGMATI PROVINCE',
          districts: ['KATHMANDU', 'LALITPUR', 'BHAKTAPUR'],
          districtItems: [
            {
              district: 'KATHMANDU',
              municipalities: ['KATHMANDU METROPOLITAN CITY'],
              municipalityItems: [
                {
                  municipality: 'KATHMANDU METROPOLITAN CITY',
                  places: [{ place: 'PASHUPATINATH TEMPLE' }],
                },
              ],
              places: ['PASHUPATINATH TEMPLE', 'BOUDHANATH STUPA'],
              placeItems: [
                {
                  place: 'PASHUPATINATH TEMPLE',
                  municipality: 'KATHMANDU METROPOLITAN CITY',
                },
              ],
            },
          ],
        },
      ],
      totals: {
        provinces: 1,
        districts: 3,
        places: 2,
      },
    },
  })
  async getCatalog() {
    const result = await this.extraService.getPlaceCatalog();
    const provinceCount = result.items.length;
    const districtCount = result.items.reduce(
      (sum, item) => sum + item.districts.length,
      0,
    );
    const placeCount = result.items.reduce(
      (sum, item) =>
        sum +
        item.districtItems.reduce(
          (districtSum, districtItem) =>
            districtSum + districtItem.places.length,
          0,
        ),
      0,
    );

    return {
      source: result.source,
      items: result.items,
      totals: {
        provinces: provinceCount,
        districts: districtCount,
        places: placeCount,
      },
    };
  }
}
