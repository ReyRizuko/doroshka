package app.dorozhka.music.core.di

import app.dorozhka.music.BuildConfig
import app.dorozhka.music.core.data.CoreStreamApi
import app.dorozhka.music.core.data.GenericAudioSourceProviderImpl
import app.dorozhka.music.core.data.RoomBackedCatalogProvider
import app.dorozhka.music.core.data.TrackDownloadSchedulerImpl
import app.dorozhka.music.core.domain.AudioSourceProvider
import app.dorozhka.music.core.domain.CatalogProvider
import app.dorozhka.music.core.domain.DownloadPermissionProvider
import app.dorozhka.music.core.domain.TrackDownloadScheduler
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit

@Module
@InstallIn(SingletonComponent::class)
object CoreNetworkModule {
    @Provides @Singleton
    fun provideJson(): Json = Json { ignoreUnknownKeys = true; explicitNulls = false }

    @Provides @Singleton
    fun provideHttpClient(): OkHttpClient =
        OkHttpClient.Builder()
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            })
            .build()

    @Provides @Singleton
    fun provideCoreStreamApi(client: OkHttpClient, json: Json): CoreStreamApi {
        val contentType = "application/json".toMediaType()
        return Retrofit.Builder()
            .baseUrl(BuildConfig.MUSIC_API_BASE_URL)
            .client(client)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()
            .create(CoreStreamApi::class.java)
    }
}

@Module
@InstallIn(SingletonComponent::class)
abstract class CoreProviderBindings {
    @Binds @Singleton
    abstract fun bindCatalogProvider(implementation: RoomBackedCatalogProvider): CatalogProvider

    @Binds @Singleton
    abstract fun bindAudioSource(implementation: GenericAudioSourceProviderImpl): AudioSourceProvider

    @Binds @Singleton
    abstract fun bindDownloadPermission(implementation: GenericAudioSourceProviderImpl): DownloadPermissionProvider

    @Binds @Singleton
    abstract fun bindDownloadScheduler(implementation: TrackDownloadSchedulerImpl): TrackDownloadScheduler
}
