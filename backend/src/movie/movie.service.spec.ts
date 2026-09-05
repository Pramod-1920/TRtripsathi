import { Types } from 'mongoose';
import { MovieService } from './movie.service';

describe('MovieService user state', () => {
  it('uses one atomic upsert key and keeps watched independent from favorite', async () => {
    const movie = {
      _id: new Types.ObjectId(),
      tmdbId: 10,
      mediaType: 'movie',
      title: 'Test',
      originalTitle: 'Test',
      overview: '',
      posterPath: null,
      backdropPath: null,
      releaseDate: null,
      rating: 8,
      voteCount: 10,
      genres: [],
      originalLanguage: 'en',
      originCountryCodes: ['US'],
      runtime: null,
      status: null,
    };
    const states = {
      findOneAndUpdate: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        watched: true,
        favorite: false,
      }),
      deleteOne: jest.fn(),
    };
    const movies = { findById: jest.fn().mockResolvedValue(movie) };
    const service = new MovieService(
      movies as never,
      states as never,
      {} as never,
    );
    const userId = new Types.ObjectId().toString();

    const result = await service.setState(
      userId,
      movie._id.toString(),
      'movie',
      'watched',
      true,
    );

    expect(states.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: new Types.ObjectId(userId), movieId: movie._id },
      expect.objectContaining({
        $set: expect.objectContaining({ watched: true }),
      }),
      expect.objectContaining({ upsert: true, new: true }),
    );
    expect(result.watched).toBe(true);
    expect(result.favorite).toBe(false);
    expect(states.deleteOne).not.toHaveBeenCalled();
  });
});
