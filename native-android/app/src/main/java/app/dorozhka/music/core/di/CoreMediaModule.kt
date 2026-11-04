package app.dorozhka.music.core.di

import android.content.Context
import androidx.media3.datasource.cache.Cache
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.okhttp.OkHttpDataSource
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import java.io.File
import javax.inject.Singleton
import okhttp3.OkHttpClient

@Module
@InstallIn(SingletonComponent::class)
object CoreMediaModule {
    @Provides
    @Singleton
    fun provideMediaCache(@ApplicationContext context: Context): Cache =
        SimpleCache(
            File(context.cacheDir, "doroshka-stream-cache"),
            LeastRecentlyUsedCacheEvictor(500L * 1024L * 1024L),
            StandaloneDatabaseProvider(context)
        )

    @Provides
    @Singleton
    fun provideCacheDataSourceFactory(
        cache: Cache,
        client: OkHttpClient
    ): CacheDataSource.Factory =
        CacheDataSource.Factory()
            .setCache(cache)
            .setUpstreamDataSourceFactory(OkHttpDataSource.Factory(client))
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
}
